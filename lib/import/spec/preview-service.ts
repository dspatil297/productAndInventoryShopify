import type { Shop } from "@/generated/prisma/client";
import { isFrozenDraftField, mergeKv, mergeText } from "@/lib/import/spec/merge";
import {
  fetchProductBaselinesBatch,
  findTakenHandles,
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

function normalizeCompareTitle(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function nextCandidateHandle(
  base: string,
  sku: string | undefined,
  usedHandles: Set<string>,
): string {
  const cleanSku = (sku ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (cleanSku) {
    const withSku = `${base}-${cleanSku}`;
    if (!usedHandles.has(withSku)) {
      return withSku;
    }
  }
  let suffix = 2;
  while (usedHandles.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
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

  const seenInFile = new Set<string>();
  const usedHandles = new Set<string>();
  for (const [handle, baseline] of baselines.entries()) {
    if (baseline) {
      usedHandles.add(handle);
    }
  }

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

    const isDuplicateInFile = seenInFile.has(draft.handle);
    seenInFile.add(draft.handle);
    usedHandles.add(draft.handle);

    if (isDuplicateInFile) {
      const suggested = nextCandidateHandle(
        draft.handle,
        draft.variants[0]?.sku,
        usedHandles,
      );
      usedHandles.add(suggested);
      preview.push({
        handle: draft.handle,
        action: "create",
        suggestedHandle: suggested,
        conflictReason: "Duplicate handle in spreadsheet",
        title: { new: draft.title },
        price: draft.variants[0]?.price
          ? { new: draft.variants[0].price }
          : undefined,
        template_suffix: draft.template_suffix
          ? { new: draft.template_suffix }
          : undefined,
        metafieldChanges: draft.metafields.length,
        warnings: [
          ...draft.warnings,
          `Duplicate handle — suggested "${suggested}"`,
        ],
        errors: [],
      });
      nextDrafts.push({ ...draft, action: "create" });
      continue;
    }

    const baseline = baselines.get(draft.handle) ?? null;
    if (baseline) {
      if (!policy.update_existing) {
        const suggested = nextCandidateHandle(
          draft.handle,
          draft.variants[0]?.sku,
          usedHandles,
        );
        usedHandles.add(suggested);
        preview.push({
          handle: draft.handle,
          action: "skip",
          suggestedHandle: suggested,
          conflictReason: `Handle already in use ("${baseline.title}")`,
          existingTitle: baseline.title,
          title: { old: baseline.title, new: draft.title },
          warnings: [
            ...draft.warnings,
            `Handle exists on store — suggested "${suggested}"`,
          ],
          errors: ["HANDLE_EXISTS"],
          metafieldChanges: 0,
        });
        nextDrafts.push({ ...draft, action: "skip", productId: baseline.id });
        continue;
      }

      const titleMismatch =
        Boolean(draft.title) &&
        normalizeCompareTitle(baseline.title) !==
          normalizeCompareTitle(draft.title);
      const suggested = titleMismatch
        ? nextCandidateHandle(draft.handle, draft.variants[0]?.sku, usedHandles)
        : undefined;
      if (suggested) {
        usedHandles.add(suggested);
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
        ...(suggested
          ? {
              suggestedHandle: suggested,
              conflictReason: `Handle exists on store as "${baseline.title}"`,
              existingTitle: baseline.title,
            }
          : {}),
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
        warnings: suggested
          ? [
              ...draft.warnings,
              `Existing product "${baseline.title}" — approve update or use "${suggested}"`,
            ]
          : draft.warnings,
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

  // Verify candidate suggested handles are actually free on Shopify
  const candidates = preview
    .map((row) => row.suggestedHandle)
    .filter((h): h is string => Boolean(h));
  if (candidates.length > 0) {
    const taken = await findTakenHandles(shop, candidates);
    if (taken.size > 0) {
      for (const h of taken) usedHandles.add(h);
      for (const row of preview) {
        if (row.suggestedHandle && taken.has(row.suggestedHandle)) {
          const next = nextCandidateHandle(row.handle, undefined, usedHandles);
          usedHandles.add(next);
          row.suggestedHandle = next;
        }
      }
    }
  }

  void mapping;
  return { drafts: nextDrafts, preview };
}
