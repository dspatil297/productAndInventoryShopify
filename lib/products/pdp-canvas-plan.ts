import type { MetafieldDefinitionNode } from "@/types/shopify";
import { metafieldColumnKey } from "@/lib/metafields/types";
import { detectJsonShape } from "@/lib/metafields/structured-json";
import {
  isVisualPdpMetafieldKey,
  VISUAL_PDP_ACCORDION_KEYS,
  VISUAL_PDP_TABLE_KEYS,
} from "@/lib/metafields/editor-hints";
import { isUnsupportedMetafieldType } from "@/lib/metafields/validators";
import type {
  ThemePdpSlot,
  ThemePdpSlotColumn,
  ThemeProductLook,
} from "@/lib/products/theme-look";
import { isPdpVisibleMetafieldKey } from "@/lib/products/theme-look";

type MetafieldDisplay =
  | "table_row"
  | "accordion"
  | "section"
  | "json_kv"
  | "json_faq"
  | "json_object";

export type PdpCanvasBlock =
  | { kind: "title" | "price" | "buy" | "description" }
  | {
      kind: "metafield";
      definition: MetafieldDefinitionNode;
      label: string;
      display: MetafieldDisplay;
    }
  | {
      kind: "details_group";
      label: string;
      rows: Array<{
        definition: MetafieldDefinitionNode;
        label: string;
      }>;
    };

function normalizeMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function jsonDisplayForDefinition(
  definition: MetafieldDefinitionNode,
  rawValue: string,
  slotDisplay?: string,
): MetafieldDisplay | null {
  if (definition.type.name !== "json") {
    if (
      slotDisplay === "json_kv" ||
      slotDisplay === "json_faq" ||
      slotDisplay === "json_object"
    ) {
      // Synthetic / mistyped slot — still honor theme json hint
      return slotDisplay;
    }
    return null;
  }

  const preferred =
    slotDisplay === "json_kv" ||
    slotDisplay === "json_faq" ||
    slotDisplay === "json_object"
      ? slotDisplay
      : null;

  // Shape from stored value beats theme default (theme often stamps json_kv)
  const fromShape = (() => {
    const shape = detectJsonShape(rawValue);
    if (shape?.kind === "faq") {
      return "json_faq" as const;
    }
    if (shape?.kind === "kv") {
      return "json_kv" as const;
    }
    if (shape?.kind === "object" || shape?.kind === "object_list") {
      return "json_object" as const;
    }
    return null;
  })();
  if (fromShape) {
    return fromShape;
  }
  if (preferred) {
    return preferred;
  }

  const hint = `${definition.key} ${definition.name}`.toLowerCase();
  if (/faq|question/.test(hint)) {
    return "json_faq";
  }
  if (/maker|craft|story|quote|bio|person|heritage|promise|process/.test(hint)) {
    return "json_object";
  }
  if (/detail|measurement|spec|included|dimension/.test(hint)) {
    return "json_kv";
  }
  return "json_kv";
}

function syntheticDefinitionFromSlot(
  slot: ThemePdpSlot,
): MetafieldDefinitionNode | null {
  if (!slot.metafieldNamespace || !slot.metafieldKey) {
    return null;
  }
  const hint = `${slot.metafieldKey} ${slot.label}`.toLowerCase();
  let typeName = "single_line_text_field";
  if (
    slot.metafieldDisplay === "json_kv" ||
    slot.metafieldDisplay === "json_faq" ||
    slot.metafieldDisplay === "json_object" ||
    /detail|faq|measurement|maker|story|included/.test(hint)
  ) {
    typeName = "json";
  } else if (/care|guide|instruction|description/.test(hint)) {
    typeName = "multi_line_text_field";
  }
  return {
    id: `theme:${slot.metafieldNamespace}.${slot.metafieldKey}`,
    namespace: slot.metafieldNamespace,
    key: slot.metafieldKey,
    name: slot.label?.trim() || slot.metafieldKey.replace(/_/g, " "),
    type: { name: typeName },
    description: null,
    validations: [],
  };
}

function resolveDefinition(
  slot: ThemePdpSlot,
  definitions: MetafieldDefinitionNode[],
  usedIds: Set<string>,
): MetafieldDefinitionNode | null {
  if (slot.metafieldNamespace && slot.metafieldKey) {
    const exact = definitions.find(
      (definition) =>
        definition.namespace === slot.metafieldNamespace &&
        definition.key === slot.metafieldKey &&
        !usedIds.has(definition.id),
    );
    if (exact) {
      return exact;
    }
    const byKey = definitions.find(
      (definition) =>
        definition.key === slot.metafieldKey && !usedIds.has(definition.id),
    );
    if (byKey) {
      return byKey;
    }
    return syntheticDefinitionFromSlot(slot);
  }
  if (slot.matchName) {
    const target = normalizeMatch(slot.matchName);
    const exactName = definitions.find(
      (definition) =>
        !usedIds.has(definition.id) &&
        normalizeMatch(definition.name) === target,
    );
    if (exactName) {
      return exactName;
    }
    const fuzzy = definitions.find((definition) => {
      if (usedIds.has(definition.id)) {
        return false;
      }
      const name = normalizeMatch(definition.name);
      return (
        name.length > 2 &&
        target.length > 2 &&
        (name.includes(target) || target.includes(name))
      );
    });
    if (fuzzy) {
      return fuzzy;
    }
  }
  return null;
}

function columnPlacement(column: ThemePdpSlotColumn): "sidebar" | "below" {
  return column === "full" ? "below" : "sidebar";
}

function displayLabel(
  slot: ThemePdpSlot,
  definition: MetafieldDefinitionNode,
): string {
  const slotLabel = slot.label?.trim();
  if (!slotLabel) {
    return definition.name;
  }
  const normalizedSlot = slotLabel.replace(/_/g, " ").toLowerCase();
  const normalizedKey = definition.key.replace(/_/g, " ").toLowerCase();
  if (normalizedSlot === normalizedKey) {
    return definition.name;
  }
  return slotLabel;
}

/**
 * Build render plan from synced theme slots (order + column).
 * Theme-bound fields only — no dump of every shop metafield.
 */
export function buildPdpCanvasPlan(
  definitions: MetafieldDefinitionNode[],
  look: ThemeProductLook | null | undefined,
  metafieldValues: Record<string, string> = {},
): { sidebar: PdpCanvasBlock[]; below: PdpCanvasBlock[] } {
  const editable = definitions.filter(
    (definition) => !isUnsupportedMetafieldType(definition.type.name),
  );
  const slots = look?.slots ?? [];
  const usedIds = new Set<string>();
  const sidebar: PdpCanvasBlock[] = [];
  const below: PdpCanvasBlock[] = [];
  let pendingTableRows: Array<{
    definition: MetafieldDefinitionNode;
    label: string;
  }> = [];

  const flushTableRows = (target: PdpCanvasBlock[], groupLabel?: string) => {
    if (pendingTableRows.length === 0) {
      return;
    }
    if (pendingTableRows.length === 1) {
      const row = pendingTableRows[0];
      target.push({
        kind: "metafield",
        definition: row.definition,
        label: row.label,
        display: "table_row",
      });
    } else {
      target.push({
        kind: "details_group",
        label: groupLabel ?? "Product details",
        rows: [...pendingTableRows],
      });
    }
    pendingTableRows = [];
  };

  const pushMetafield = (
    slot: ThemePdpSlot,
    definition: MetafieldDefinitionNode,
    target: PdpCanvasBlock[],
  ) => {
    const columnKey = metafieldColumnKey(definition.namespace, definition.key);
    const rawValue = metafieldValues[columnKey] ?? "";
    const jsonDisplay = jsonDisplayForDefinition(
      definition,
      rawValue,
      slot.metafieldDisplay,
    );

    let display: MetafieldDisplay =
      slot.metafieldDisplay ??
      (slot.column === "full" ? "accordion" : "table_row");

    if (jsonDisplay) {
      display = jsonDisplay;
    } else if (
      display === "table_row" &&
      definition.type.name === "multi_line_text_field"
    ) {
      display = "accordion";
    }

    const label = displayLabel(slot, definition);

    if (
      display === "json_kv" ||
      display === "json_faq" ||
      display === "json_object"
    ) {
      flushTableRows(target);
      target.push({
        kind: "metafield",
        definition,
        label,
        display,
      });
      return;
    }

    if (display === "table_row" && target === sidebar) {
      pendingTableRows.push({ definition, label });
      return;
    }
    flushTableRows(target);
    if (display === "section" || (display === "accordion" && target === below)) {
      target.push({
        kind: "metafield",
        definition,
        label,
        display: target === below ? "section" : "accordion",
      });
      return;
    }
    target.push({
      kind: "metafield",
      definition,
      label,
      display: display === "table_row" ? "table_row" : "accordion",
    });
  };

  for (const slot of slots) {
    if (slot.kind === "media") {
      continue;
    }
    const target = columnPlacement(slot.column) === "below" ? below : sidebar;

    if (slot.kind === "title" || slot.kind === "price" || slot.kind === "buy") {
      flushTableRows(target);
      sidebar.push({ kind: slot.kind });
      continue;
    }
    if (slot.kind === "description") {
      flushTableRows(target);
      if (slot.column === "full") {
        below.push({ kind: "description" });
      } else {
        sidebar.push({ kind: "description" });
      }
      continue;
    }
    if (slot.kind !== "metafield") {
      continue;
    }

    const definition = resolveDefinition(slot, editable, usedIds);
    if (!definition) {
      continue;
    }
    usedIds.add(definition.id);
    pushMetafield(slot, definition, target);
  }

  flushTableRows(sidebar);
  flushTableRows(below);

  // ponytail: theme sync can miss bulk-upload PDP fields — still show on visual fill
  for (const definition of editable) {
    if (usedIds.has(definition.id)) {
      continue;
    }
    if (!isPdpVisibleMetafieldKey(definition.key)) {
      continue;
    }
    if (!isVisualPdpMetafieldKey(definition.key)) {
      continue;
    }

    const columnKey = metafieldColumnKey(definition.namespace, definition.key);
    const rawValue = metafieldValues[columnKey] ?? "";
    const label = definition.name?.trim() || definition.key.replace(/_/g, " ");
    usedIds.add(definition.id);

    if (VISUAL_PDP_TABLE_KEYS.has(definition.key)) {
      pendingTableRows.push({ definition, label });
      flushTableRows(sidebar, "Product details");
      continue;
    }

    const jsonDisplay = jsonDisplayForDefinition(
      definition,
      rawValue,
      definition.type.name === "json" ? "json_object" : undefined,
    );

    if (
      jsonDisplay === "json_kv" ||
      jsonDisplay === "json_faq" ||
      jsonDisplay === "json_object" ||
      VISUAL_PDP_ACCORDION_KEYS.has(definition.key)
    ) {
      flushTableRows(below);
      below.push({
        kind: "metafield",
        definition,
        label,
        display:
          jsonDisplay === "json_kv" ||
          jsonDisplay === "json_faq" ||
          jsonDisplay === "json_object"
            ? jsonDisplay
            : "json_object",
      });
      continue;
    }

    if (definition.type.name.startsWith("list.")) {
      flushTableRows(sidebar);
      pendingTableRows.push({ definition, label });
      flushTableRows(sidebar, "Product details");
      continue;
    }

    flushTableRows(below);
    below.push({
      kind: "metafield",
      definition,
      label,
      display: "accordion",
    });
  }

  flushTableRows(sidebar);
  flushTableRows(below);

  if (!sidebar.some((block) => block.kind === "title")) {
    sidebar.unshift({ kind: "title" });
  }
  if (!sidebar.some((block) => block.kind === "price")) {
    const titleIndex = sidebar.findIndex((block) => block.kind === "title");
    sidebar.splice(titleIndex + 1, 0, { kind: "price" });
  }
  if (!sidebar.some((block) => block.kind === "buy")) {
    const priceIndex = sidebar.findIndex((block) => block.kind === "price");
    sidebar.splice(priceIndex + 1, 0, { kind: "buy" });
  }

  return { sidebar, below };
}

export function heritageMfName(definition: MetafieldDefinitionNode): string {
  return `mf[${metafieldColumnKey(definition.namespace, definition.key)}]`;
}

/** @deprecated */
export function resolvePdpPlacement(
  definitions: MetafieldDefinitionNode[],
  look: ThemeProductLook | null | undefined,
) {
  const plan = buildPdpCanvasPlan(definitions, look);
  const beside = plan.sidebar
    .filter(
      (block): block is Extract<PdpCanvasBlock, { kind: "metafield" }> =>
        block.kind === "metafield" && block.display === "table_row",
    )
    .map((block, index) => ({
      definition: block.definition,
      placement: "beside" as const,
      label: block.label,
      order: index,
    }));
  const below = [
    ...plan.sidebar.filter((b) => b.kind === "metafield"),
    ...plan.below,
  ]
    .filter(
      (block): block is Extract<PdpCanvasBlock, { kind: "metafield" }> =>
        block.kind === "metafield",
    )
    .map((block, index) => ({
      definition: block.definition,
      placement: "below" as const,
      label: block.label,
      order: index,
    }));
  return { beside, below };
}

export function splitHeritageMetafields(definitions: MetafieldDefinitionNode[]) {
  const { sidebar, below } = buildPdpCanvasPlan(definitions, null);
  const table = sidebar.flatMap((block) => {
    if (block.kind === "details_group") {
      return block.rows.map((row) => row.definition);
    }
    if (block.kind === "metafield" && block.display === "table_row") {
      return [block.definition];
    }
    return [];
  });
  const accordions = below
    .filter(
      (block): block is Extract<PdpCanvasBlock, { kind: "metafield" }> =>
        block.kind === "metafield",
    )
    .map((block) => block.definition);
  return { table, accordions, below: [] };
}

export function resolvePdpMetafields(
  definitions: MetafieldDefinitionNode[],
  themeBoundKeys: Set<string>,
) {
  const look: ThemeProductLook | null =
    themeBoundKeys.size > 0
      ? {
          colors: {
            background: "#fff",
            text: "#000",
            muted: "#666",
            buttonBg: "#000",
            buttonText: "#fff",
            border: "#ccc",
          },
          sections: [],
          slots: [...themeBoundKeys].map((columnKey) => {
            const [namespace, key] = columnKey.split(".");
            return {
              id: `legacy:${columnKey}`,
              kind: "metafield" as const,
              label: key ?? columnKey,
              column: "info" as const,
              metafieldNamespace: namespace,
              metafieldKey: key,
            };
          }),
        }
      : null;
  const { table, accordions } = splitHeritageMetafields(definitions);
  void look;
  return { table, accordions, below: [] };
}
