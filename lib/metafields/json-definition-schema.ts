import type { MetafieldDefinitionNode } from "@/types/shopify";

type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  required?: string[];
};

function parseSchemaValidation(
  validations: MetafieldDefinitionNode["validations"] | undefined,
): JsonSchemaNode | null {
  if (!validations?.length) {
    return null;
  }
  const schemaRule = validations.find((rule) => rule.name === "schema");
  if (!schemaRule?.value?.trim()) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(schemaRule.value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as JsonSchemaNode;
  } catch {
    return null;
  }
}

function schemaType(node: JsonSchemaNode | undefined): string | null {
  if (!node?.type) {
    return null;
  }
  if (Array.isArray(node.type)) {
    return node.type.find((entry) => entry !== "null") ?? node.type[0] ?? null;
  }
  return node.type;
}

function orderedPropertyKeys(
  properties: Record<string, JsonSchemaNode>,
  required?: string[],
): string[] {
  const keys = Object.keys(properties);
  if (!required?.length) {
    return keys;
  }
  const ordered = required.filter((key) => keys.includes(key));
  for (const key of keys) {
    if (!ordered.includes(key)) {
      ordered.push(key);
    }
  }
  return ordered;
}

/**
 * Top-level editable keys from Shopify metafield definition JSON schema.
 * Works for any store — no hardcoded key list.
 */
export function jsonObjectFieldsFromDefinition(
  definition:
    | Pick<MetafieldDefinitionNode, "validations" | "type">
    | null
    | undefined,
): string[] {
  if (!definition || definition.type.name !== "json") {
    return [];
  }
  const schema = parseSchemaValidation(definition.validations);
  if (!schema) {
    return [];
  }

  const rootType = schemaType(schema);
  if (rootType === "object" && schema.properties) {
    return orderedPropertyKeys(schema.properties, schema.required);
  }

  if (rootType === "array" && schema.items) {
    const itemType = schemaType(schema.items);
    if (itemType === "object" && schema.items.properties) {
      return orderedPropertyKeys(schema.items.properties, schema.items.required);
    }
  }

  return [];
}
