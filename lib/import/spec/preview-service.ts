import type { Shop } from "@/generated/prisma/client";
import { isFrozenDraftField, mergeKv, mergeText } from "@/lib/import/spec/merge";
import {
  fetchProductBaselinesBatch,
  type ProductBaseline,
} from "@/lib/import/spec/product-baseline";
import type {
  ImportPolicy,
  MappingConfig,
  PreviewRowDiff,
  ProductDraft,
} from "@/lib/import/spec/types";

function applyFrozenFieldsOnUpdate(
  draft: ProductDraft,
  policy: ImportPolicy,
  baseline: ProductBaseline | null,
): ProductDraft {
  if (!baseline) {
    return draft;
  }

  const next = { ...draft, variants: [...draft.variants] };
  if (next.variants[0]) {
    const variant = { ...next.variants[0] };
    if (isFrozenDraftField(policy.frozen_fields, "variant.sku")) {
      variant.sku = baseline.sku || variant.sku;
    }
    next.variants[0] = variant;
  }
  return next;
}

function mergeMetafieldValue(
  strategy: ProductDraft["metafields"][0]["merge_strategy"],
  oldValue: string,
  newValue: string,
): string {
  const normalizedOld =
    oldValue.trim() === "[]" || oldValue.trim() === "{}" ? "" : oldValue;
  if (strategy === "merge_kv") {
    return mergeKv(normalizedOld, newValue);
  }
  if (strategy === "merge_text" || strategy === "skip_if_empty") {
    return mergeText(normalizedOld, newValue);
  }
  return newValue;
}

async function prefetchBaselines(
  shop: Shop,
  handles: string[],
): Promise<Map<string, ProductBaseline | null>> {
  return fetchProductBaselinesBatch(shop, handles);
}

export async function buildPreviewDiffs(
  shop: Shop,
  drafts: ProductDraft[],
  policy: ImportPolicy,
  mapping: MappingConfig,
): Promise<{ drafts: ProductDraft[]; preview: PreviewRowDiff[] }> {
  const preview: PreviewRowDiff[] = [];
  const nextDrafts: ProductDraft[] = [];

  const baselineHandles = drafts
    .filter((draft) => draft.errors.length === 0)
    .map((draft) => draft.handle);
  const baselines = await prefetchBaselines(shop, baselineHandles);

  for (const draft of drafts) {
    if (draft.errors.length > 0) {
      preview.push({
        handle: draft.handle,
        action: "error",
        metafieldChanges: 0,
        warnings: draft.warnings,
        errors: draft.errors,
      });
      nextDrafts.push({ ...draft, action: "skip" });
      continue;
    }

    const baseline = baselines.get(draft.handle) ?? null;
    if (baseline) {
      if (!policy.update_existing) {
        preview.push({
          handle: draft.handle,
          action: "skip",
          title: { old: baseline.title, new: draft.title },
          warnings: draft.warnings,
          errors: ["HANDLE_EXISTS"],
          metafieldChanges: 0,
        });
        nextDrafts.push({ ...draft, action: "skip", productId: baseline.id });
        continue;
      }

      let workingDraft = applyFrozenFieldsOnUpdate(draft, policy, baseline);
      const metafieldDiffs: PreviewRowDiff["metafieldDiffs"] = [];

      workingDraft = {
        ...workingDraft,
        metafields: workingDraft.metafields.map((metafield) => {
          const key = `${metafield.namespace}.${metafield.key}`;
          const oldValue = baseline.metafields[key] ?? "";
          const newRaw = String(metafield.value);
          const merged = mergeMetafieldValue(
            metafield.merge_strategy,
            oldValue,
            newRaw,
          );
          if (merged !== oldValue) {
            metafieldDiffs.push({
              key,
              old: oldValue.slice(0, 120) || undefined,
              new: merged.slice(0, 120) || undefined,
            });
          }
          return { ...metafield, value: merged };
        }),
      };

      preview.push({
        handle: draft.handle,
        action: "update",
        title:
          workingDraft.title && workingDraft.title !== baseline.title
            ? { old: baseline.title, new: workingDraft.title }
            : undefined,
        price:
          workingDraft.variants[0]?.price &&
            workingDraft.variants[0].price !== baseline.price
            ? { old: baseline.price, new: workingDraft.variants[0].price }
            : undefined,
        template_suffix:
          workingDraft.template_suffix &&
            workingDraft.template_suffix !== baseline.template_suffix
            ? { old: baseline.template_suffix, new: workingDraft.template_suffix }
            : undefined,
        metafieldChanges: metafieldDiffs.length,
        metafieldDiffs,
        warnings: draft.warnings,
        errors: [],
      });
      nextDrafts.push({
        ...workingDraft,
        action: "update",
        productId: baseline.id,
        variantId: baseline.variantId,
      });
      continue;
    }

    if (!policy.create_missing) {
      preview.push({
        handle: draft.handle,
        action: "error",
        metafieldChanges: 0,
        warnings: draft.warnings,
        errors: ["HANDLE_NOT_FOUND"],
      });
      nextDrafts.push({ ...draft, action: "skip" });
      continue;
    }

    preview.push({
      handle: draft.handle,
      action: "create",
      title: { new: draft.title },
      price: draft.variants[0]?.price
        ? { new: draft.variants[0].price }
        : undefined,
      template_suffix: draft.template_suffix
        ? { new: draft.template_suffix }
        : undefined,
      metafieldChanges: draft.metafields.length,
      warnings: draft.warnings,
      errors: [],
    });
    nextDrafts.push({ ...draft, action: "create" });
  }

  void mapping;
  return { drafts: nextDrafts, preview };
}
