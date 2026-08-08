import { detectJsonShape } from "@/lib/metafields/structured-json";
import type { MetafieldDefinitionNode } from "@/types/shopify";
import {
  editorHintForMetafieldKey,
  mergeJsonObjectFields,
  type MetafieldEditorHint,
} from "@/lib/metafields/editor-hints";
import { jsonObjectFieldsFromDefinition } from "@/lib/metafields/json-definition-schema";
import { listValueToPairJson } from "@/lib/metafields/list-line-formats";

export type ResolvedMetafieldEditor =
  | {
      kind: "pair_list";
      hiddenValue: string;
      mode: "kv" | "faq" | "vk";
      storage: "json" | "list_lines";
      listFormat?: "kv" | "vk" | "faq_lines";
    }
  | {
      kind: "json_object";
      hiddenValue: string;
      mode: "object" | "object_list";
      fields: string[];
    }
  | {
      kind: "tags";
      hiddenValue: string;
    }
  | {
      kind: "generic";
      typeName: string;
      hiddenValue: string;
    };

function resolveListEditor(
  rawValue: string,
  hint: MetafieldEditorHint | null,
): ResolvedMetafieldEditor | null {
  const fromValue = listValueToPairJson(rawValue);
  if (fromValue) {
    return {
      kind: "pair_list",
      hiddenValue: fromValue.hiddenValue,
      mode: fromValue.mode,
      storage: fromValue.storage,
      listFormat: fromValue.format,
    };
  }

  if (!hint || !hint.startsWith("list_")) {
    return null;
  }

  const mode =
    hint === "list_faq" ? "faq" : hint === "list_vk" ? "vk" : "kv";
  return {
    kind: "pair_list",
    hiddenValue: rawValue.trim() ? rawValue : "[]",
    mode,
    storage: "list_lines",
    listFormat:
      hint === "list_faq"
        ? "faq_lines"
        : hint === "list_vk"
          ? "vk"
          : "kv",
  };
}

export type MetafieldEditorContext =
  | Pick<MetafieldDefinitionNode, "validations" | "type" | "key">
  | null
  | undefined;

function resolveJsonEditor(
  rawValue: string,
  key: string,
  hint: MetafieldEditorHint | null,
  definition?: MetafieldEditorContext,
): ResolvedMetafieldEditor | null {
  const trimmed = rawValue.trim();

  if (trimmed) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        const listEditor = listValueToPairJson(trimmed);
        if (listEditor) {
          return {
            kind: "pair_list",
            hiddenValue: listEditor.hiddenValue,
            mode: listEditor.mode,
            storage: listEditor.storage,
            listFormat: listEditor.format,
          };
        }
      }
    } catch {
      // fall through
    }
  }

  const shape = trimmed ? detectJsonShape(trimmed) : null;
  if (shape?.kind === "kv" || shape?.kind === "faq") {
    return {
      kind: "pair_list",
      hiddenValue: trimmed || "[]",
      mode: shape.kind,
      storage: "json",
    };
  }
  if (shape?.kind === "object") {
    return {
      kind: "json_object",
      hiddenValue: trimmed,
      mode: "object",
      fields: mergeJsonObjectFields(key, shape.fields, definition),
    };
  }
  if (shape?.kind === "object_list") {
    return {
      kind: "json_object",
      hiddenValue: trimmed,
      mode: "object_list",
      fields: mergeJsonObjectFields(key, shape.fields, definition),
    };
  }

  if (hint === "json_object" || JSON_OBJECT_HINT.test(key)) {
    const fields = mergeJsonObjectFields(key, [], definition);
    return {
      kind: "json_object",
      hiddenValue: trimmed || "{}",
      mode: "object",
      fields,
    };
  }

  const schemaFields = jsonObjectFieldsFromDefinition(definition);
  if (schemaFields.length > 0) {
    return {
      kind: "json_object",
      hiddenValue: trimmed || "{}",
      mode: "object",
      fields: mergeJsonObjectFields(key, schemaFields, definition),
    };
  }

  if (hint === "json_kv" || hint === "json_faq") {
    return {
      kind: "pair_list",
      hiddenValue: trimmed || "[]",
      mode: hint === "json_faq" ? "faq" : "kv",
      storage: "json",
    };
  }

  return null;
}

const JSON_OBJECT_HINT = /story|maker|process|heritage|styling/i;

export function keyFromFieldName(name: string): string {
  const match = name.match(/^mf\[(.+)\]$/);
  if (!match) {
    return "";
  }
  const columnKey = match[1];
  const dot = columnKey.indexOf(".");
  return dot >= 0 ? columnKey.slice(dot + 1) : columnKey;
}

export function resolveMetafieldEditor(
  typeName: string,
  rawValue: string,
  key = "",
  definition?: MetafieldEditorContext,
): ResolvedMetafieldEditor {
  const hint = editorHintForMetafieldKey(key, typeName);

  if (typeName.startsWith("list.")) {
    const listEditor = resolveListEditor(rawValue, hint);
    if (listEditor) {
      return listEditor;
    }
    return { kind: "tags", hiddenValue: rawValue };
  }

  if (typeName === "json") {
    const jsonEditor = resolveJsonEditor(rawValue, key, hint, definition);
    if (jsonEditor) {
      return jsonEditor;
    }
    return { kind: "generic", typeName, hiddenValue: rawValue };
  }

  return { kind: "generic", typeName, hiddenValue: rawValue };
}
