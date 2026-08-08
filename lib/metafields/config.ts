import type { ShopConfig } from "@/generated/prisma/client";
import type { MetafieldDefinitionNode } from "@/types/shopify";

function isMetafieldDefinitionNode(value: unknown): value is MetafieldDefinitionNode {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.namespace === "string" &&
    typeof record.key === "string" &&
    typeof record.name === "string" &&
    typeof record.type === "object" &&
    record.type !== null &&
    typeof (record.type as { name?: unknown }).name === "string"
  );
}

export function readMetafieldDefinitionsFromConfig(
  config: ShopConfig | null | undefined,
): MetafieldDefinitionNode[] {
  const raw = config?.metafieldDefinitions;
  if (!Array.isArray(raw)) {
    return [];
  }

  const items = raw as unknown[];

  return items
    .filter((value): value is MetafieldDefinitionNode =>
      isMetafieldDefinitionNode(value),
    )
    .sort((left, right) => {
      const leftLabel = `${left.namespace}.${left.key}`;
      const rightLabel = `${right.namespace}.${right.key}`;
      return leftLabel.localeCompare(rightLabel);
    });
}
