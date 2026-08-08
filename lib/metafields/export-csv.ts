import type { MetafieldGridRow } from "@/lib/metafields/types";
import { metafieldColumnKey } from "@/lib/metafields/types";
import type { MetafieldDefinitionNode } from "@/types/shopify";

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildMetafieldsCsv(
  rows: MetafieldGridRow[],
  definitions: MetafieldDefinitionNode[],
): string {
  const headers = [
    "product_id",
    "title",
    "handle",
    ...definitions.map((definition) =>
      metafieldColumnKey(definition.namespace, definition.key),
    ),
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    const values = [
      row.productId,
      row.title,
      row.handle,
      ...definitions.map((definition) => {
        const columnKey = metafieldColumnKey(definition.namespace, definition.key);
        return row.values[columnKey]?.value ?? "";
      }),
    ];

    lines.push(values.map((value) => escapeCsvValue(value)).join(","));
  }

  return `${lines.join("\n")}\n`;
}
