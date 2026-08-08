import type { InventoryRow } from "@/lib/inventory/types";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildInventoryCsv(
  rows: InventoryRow[],
  locationName: string,
): string {
  const header = [
    "product_title",
    "product_handle",
    "variant_title",
    "sku",
    "location",
    "tracked",
    "available",
    "on_hand",
    "committed",
    "incoming",
  ];

  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.productTitle),
        csvEscape(row.productHandle),
        csvEscape(row.variantTitle),
        csvEscape(row.sku ?? ""),
        csvEscape(locationName),
        row.tracked ? "true" : "false",
        row.quantities.available ?? "",
        row.quantities.onHand ?? "",
        row.quantities.committed ?? "",
        row.quantities.incoming ?? "",
      ].join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}
