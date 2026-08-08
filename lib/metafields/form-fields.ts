import type { MetafieldUpdateInput } from "@/lib/metafields/types";

export function cellFieldName(index: number, field: string): string {
  return `cells[${index}][${field}]`;
}

export function parseMetafieldUpdatesFromFormData(
  formData: FormData,
): MetafieldUpdateInput[] {
  const cells = new Map<
    number,
    Partial<MetafieldUpdateInput & { baseline?: string }>
  >();

  for (const [key, rawValue] of formData.entries()) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const match = /^cells\[(\d+)\]\[(\w+)\]$/.exec(key);
    if (!match) {
      continue;
    }

    const index = Number.parseInt(match[1], 10);
    const field = match[2];
    const row = cells.get(index) ?? {};
    cells.set(index, row);

    if (field === "ownerId") {
      row.ownerId = rawValue;
    } else if (field === "namespace") {
      row.namespace = rawValue;
    } else if (field === "key") {
      row.key = rawValue;
    } else if (field === "type") {
      row.type = rawValue;
    } else if (field === "value") {
      row.value = rawValue;
    } else if (field === "baseline") {
      row.baseline = rawValue;
    }
  }

  const updates: MetafieldUpdateInput[] = [];

  for (const row of cells.values()) {
    if (
      !row.ownerId ||
      !row.namespace ||
      !row.key ||
      !row.type ||
      row.value === undefined
    ) {
      continue;
    }

    if (row.value === row.baseline) {
      continue;
    }

    updates.push({
      ownerId: row.ownerId,
      namespace: row.namespace,
      key: row.key,
      type: row.type,
      value: row.value,
    });
  }

  return updates;
}

export function safeMetafieldReturnTo(
  raw: FormDataEntryValue | null,
  fallback: string,
): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

export function appendMetafieldFlashParams(
  returnTo: string,
  flash: Record<string, string>,
): string {
  const url = new URL(returnTo, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}
