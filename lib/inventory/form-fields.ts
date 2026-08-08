import type {
  InventoryAdjustInput,
  InventorySetInput,
} from "@/lib/inventory/types";

export function safeInventoryReturnTo(
  raw: FormDataEntryValue | null,
  fallback: string,
): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}

export function appendInventoryFlashParams(
  returnTo: string,
  flash: Record<string, string>,
): string {
  const url = new URL(returnTo, "https://local.invalid");
  for (const [key, value] of Object.entries(flash)) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

function readInt(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

interface PickPayload {
  inventoryItemId: string;
  changeFromQuantity: number | null;
}

function parsePickPayload(raw: string): PickPayload | null {
  try {
    const parsed = JSON.parse(raw) as {
      inventoryItemId?: unknown;
      changeFromQuantity?: unknown;
    };
    if (typeof parsed.inventoryItemId !== "string" || !parsed.inventoryItemId) {
      return null;
    }
    let changeFromQuantity: number | null = null;
    if (
      typeof parsed.changeFromQuantity === "number" &&
      Number.isFinite(parsed.changeFromQuantity)
    ) {
      changeFromQuantity = parsed.changeFromQuantity;
    }
    return {
      inventoryItemId: parsed.inventoryItemId,
      changeFromQuantity,
    };
  } catch {
    return null;
  }
}

function readPicks(formData: FormData): PickPayload[] {
  return formData
    .getAll("pick")
    .filter((value): value is string => typeof value === "string")
    .map(parsePickPayload)
    .filter((value): value is PickPayload => value !== null);
}

export function parseInventoryBulkSetFromFormData(
  formData: FormData,
): InventorySetInput[] {
  const locationId = formData.get("locationId");
  if (typeof locationId !== "string" || !locationId) {
    return [];
  }

  const quantity = readInt(formData.get("quantity"));
  if (quantity === null) {
    return [];
  }

  const picks = readPicks(formData);
  if (picks.length > 0) {
    return picks.map((pick) => ({
      inventoryItemId: pick.inventoryItemId,
      locationId,
      quantity,
      changeFromQuantity: pick.changeFromQuantity,
    }));
  }

  // Legacy items[n] shape
  const items = new Map<
    number,
    { inventoryItemId?: string; changeFromQuantity: number | null }
  >();

  for (const [key, rawValue] of formData.entries()) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const match = /^items\[(\d+)\]\[(\w+)\]$/.exec(key);
    if (!match) {
      continue;
    }

    const index = Number.parseInt(match[1], 10);
    const field = match[2];
    const row = items.get(index) ?? { changeFromQuantity: null };
    items.set(index, row);

    if (field === "inventoryItemId") {
      row.inventoryItemId = rawValue;
    } else if (field === "changeFromQuantity") {
      if (rawValue.trim() === "") {
        row.changeFromQuantity = null;
      } else {
        const parsed = Number.parseInt(rawValue, 10);
        row.changeFromQuantity = Number.isFinite(parsed) ? parsed : null;
      }
    }
  }

  if (items.size > 0) {
    const updates: InventorySetInput[] = [];
    for (const row of items.values()) {
      if (!row.inventoryItemId) {
        continue;
      }
      updates.push({
        inventoryItemId: row.inventoryItemId,
        locationId,
        quantity,
        changeFromQuantity: row.changeFromQuantity,
      });
    }
    return updates;
  }

  // Single-row form
  const inventoryItemId = formData.get("inventoryItemId");
  if (typeof inventoryItemId !== "string") {
    return [];
  }

  const changeFromRaw = formData.get("changeFromQuantity");
  let changeFromQuantity: number | null = null;
  if (typeof changeFromRaw === "string" && changeFromRaw.trim() !== "") {
    const parsed = Number.parseInt(changeFromRaw, 10);
    if (!Number.isFinite(parsed)) {
      return [];
    }
    changeFromQuantity = parsed;
  }

  return [
    {
      inventoryItemId,
      locationId,
      quantity,
      changeFromQuantity,
    },
  ];
}

export function parseInventorySetFromFormData(
  formData: FormData,
): InventorySetInput | null {
  return parseInventoryBulkSetFromFormData(formData)[0] ?? null;
}

export function parseInventoryBulkAdjustFromFormData(
  formData: FormData,
): InventoryAdjustInput[] {
  const locationId = formData.get("locationId");
  const delta = readInt(formData.get("delta"));

  if (typeof locationId !== "string" || !locationId || delta === null || delta === 0) {
    return [];
  }

  const picks = readPicks(formData);
  if (picks.length > 0) {
    return picks.map((pick) => ({
      inventoryItemId: pick.inventoryItemId,
      locationId,
      delta,
    }));
  }

  const itemIds = formData.getAll("inventoryItemId").filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return itemIds.map((inventoryItemId) => ({
    inventoryItemId,
    locationId,
    delta,
  }));
}

export function parseInventoryAdjustFromFormData(
  formData: FormData,
): InventoryAdjustInput | null {
  return parseInventoryBulkAdjustFromFormData(formData)[0] ?? null;
}
