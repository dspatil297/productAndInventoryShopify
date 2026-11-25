import type { Shop } from "@/generated/prisma/client";
import { setShopMetafields } from "@/lib/metafields/set-metafields";
import { DEFAULT_IMPORT_POLICY } from "@/lib/import/spec/import-policy";
import { isFrozenDraftField } from "@/lib/import/spec/merge";
import type { ImportReport, ProductDraft } from "@/lib/import/spec/types";
import { createShopProduct } from "@/lib/products/create-product";
import { updateShopProduct } from "@/lib/products/update-product";

export async function runImportWorker(
  shop: Shop,
  sessionId: string,
  drafts: ProductDraft[],
  resumeFromHandle?: string,
): Promise<ImportReport> {
  const startedAt = new Date().toISOString();
  const report: ImportReport = {
    session_id: sessionId,
    started_at: startedAt,
    summary: { created: 0, updated: 0, failed: 0, skipped: 0 },
    handles: [],
  };

  let resume = !resumeFromHandle;

  for (const draft of drafts) {
    if (!resume) {
      if (draft.handle === resumeFromHandle) {
        resume = true;
      } else {
        continue;
      }
    }

    if (draft.action === "skip" || draft.errors.length > 0) {
      report.summary.skipped += 1;
      report.handles.push({
        handle: draft.handle,
        status: "skipped",
        errors: draft.errors,
      });
      continue;
    }

    if (draft.action === "create") {
      const result = await createShopProduct(shop, {
        title: draft.title ?? draft.handle,
        handle: draft.handle,
        descriptionHtml: draft.body_html,
        templateSuffix: draft.template_suffix ?? null,
        status: "DRAFT",
        price: draft.variants[0]?.price,
        compareAtPrice: draft.variants[0]?.compare_at_price,
        sku: draft.variants[0]?.sku,
        publish: false,
        metafields: draft.metafields.map((metafield) => ({
          namespace: metafield.namespace,
          key: metafield.key,
          type: metafield.type,
          value: String(metafield.value),
        })),
      });

      if (!result.productId) {
        report.summary.failed += 1;
        report.handles.push({
          handle: draft.handle,
          status: "failed",
          errors: result.errors,
        });
        report.resume_from_handle = draft.handle;
        break;
      }

      report.summary.created += 1;
      report.handles.push({
        handle: draft.handle,
        status: "created",
        metafields_set: draft.metafields.length,
        errors: result.errors,
      });
      continue;
    }

    if (draft.action === "update" && draft.productId) {
      const variant = { ...draft.variants[0] };
      if (isFrozenDraftField(DEFAULT_IMPORT_POLICY.frozen_fields, "variant.sku")) {
        variant.sku = undefined;
      }

      const result = await updateShopProduct(shop, {
        productId: draft.productId,
        title: draft.title ?? draft.handle,
        handle: draft.handle,
        descriptionHtml: draft.body_html,
        templateSuffix: draft.template_suffix ?? undefined,
        price: variant?.price,
        compareAtPrice: variant?.compare_at_price,
        sku: variant?.sku,
        metafields: draft.metafields.map((metafield) => ({
          namespace: metafield.namespace,
          key: metafield.key,
          type: metafield.type,
          value: String(metafield.value),
        })),
      });

      if (!result.productId) {
        report.summary.failed += 1;
        report.handles.push({
          handle: draft.handle,
          status: "failed",
          errors: result.errors,
        });
        report.resume_from_handle = draft.handle;
        break;
      }

      const listJsonMetafields = draft.metafields.filter(
        (metafield) =>
          metafield.type === "json" || metafield.type.startsWith("list."),
      );
      if (listJsonMetafields.length > 0) {
        await setShopMetafields(
          shop,
          listJsonMetafields.map((metafield) => ({
            ownerId: draft.productId!,
            namespace: metafield.namespace,
            key: metafield.key,
            type: metafield.type,
            value: String(metafield.value),
          })),
        );
      }

      report.summary.updated += 1;
      report.handles.push({
        handle: draft.handle,
        status: "updated",
        metafields_set: draft.metafields.length,
        errors: result.errors,
      });
    }
  }

  report.completed_at = new Date().toISOString();
  return report;
}
