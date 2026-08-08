/**
 * PDP metafield editor hints — detect from key + type, any store.
 * Prefer Shopify definition JSON schema (json-definition-schema.ts).
 * Key hints below are optional fallbacks when schema + stored value are empty.
 */

import type { MetafieldDefinitionNode } from "@/types/shopify";
import { jsonObjectFieldsFromDefinition } from "@/lib/metafields/json-definition-schema";

export type MetafieldEditorHint =
  | "list_kv"
  | "list_vk"
  | "list_faq"
  | "json_object"
  | "json_kv"
  | "json_faq";

const LIST_KV_KEYS =
  /^product_(details|measurements|whats_included|measurement)$/i;
const LIST_FAQ_KEYS = /^product_faq$/i;
const LIST_VK_KEYS = /^product_impact_stats$/i;
const JSON_STORY_KEYS =
  /^(product_maker_story|product_process_story|product_heritage_story|pdp_styling_story)$/i;

/** Default top-level keys when story JSON is empty (theme / bulk upload shapes). */
export const JSON_OBJECT_FIELD_HINTS: Record<string, string[]> = {
  product_maker_story: [
    "eyebrow",
    "heading_html",
    "name",
    "role",
    "intro_paragraphs",
    "quote",
    "closing_paragraphs",
    "stats",
    "meta",
  ],
  product_maker_id: ["id", "name", "role"],
  product_maker_portrait: ["url", "alt", "caption"],
  product_process_story: [
    "eyebrow",
    "heading_html",
    "description",
    "steps",
  ],
  product_heritage_story: [
    "eyebrow",
    "heading_html",
    "paragraphs",
    "fabric_cards",
  ],
  pdp_styling_story: ["eyebrow", "heading_html", "cards"],
};

export function editorHintForMetafieldKey(
  key: string,
  typeName: string,
): MetafieldEditorHint | null {
  if (LIST_KV_KEYS.test(key)) {
    return "list_kv";
  }
  if (LIST_FAQ_KEYS.test(key)) {
    return "list_faq";
  }
  if (LIST_VK_KEYS.test(key)) {
    return "list_vk";
  }
  if (JSON_STORY_KEYS.test(key) || (typeName === "json" && /story|maker|process|heritage|styling/i.test(key))) {
    return "json_object";
  }
  return null;
}

export function jsonObjectFieldsForKey(key: string): string[] {
  const normalized = key.trim().toLowerCase();
  return (
    JSON_OBJECT_FIELD_HINTS[normalized] ??
    JSON_OBJECT_FIELD_HINTS[key] ??
    []
  );
}

/** Hint schema + keys from stored JSON (deduped, hints fill empty/new products). */
export function mergeJsonObjectFields(
  key: string,
  detected: string[],
  definition?: Pick<MetafieldDefinitionNode, "validations" | "type"> | null,
): string[] {
  const fromSchema = jsonObjectFieldsFromDefinition(definition);
  const hinted = jsonObjectFieldsForKey(key);
  const merged = [...detected];
  for (const field of [...fromSchema, ...hinted]) {
    if (!merged.includes(field)) {
      merged.push(field);
    }
  }
  if (merged.length > 0) {
    return merged;
  }
  if (fromSchema.length > 0) {
    return fromSchema;
  }
  return hinted;
}

/** Metafields that belong on visual PDP fill even when theme sync missed them. */
export const VISUAL_PDP_TABLE_KEYS = new Set([
  "product_details",
  "product_measurements",
  "product_measurement_highlight",
  "product_measurement_note",
  "product_whats_included",
  "product_impact_stats",
]);

export const VISUAL_PDP_ACCORDION_KEYS = new Set([
  "product_faq",
  "product_care_instructions",
  "product_impact_note",
  "product_maker_id",
  "product_maker_portrait",
  "product_maker_story",
  "product_process_story",
  "product_heritage_story",
  "pdp_styling_story",
]);

export function isVisualPdpMetafieldKey(key: string): boolean {
  return (
    VISUAL_PDP_TABLE_KEYS.has(key) ||
    VISUAL_PDP_ACCORDION_KEYS.has(key) ||
    /^product_/.test(key)
  );
}
