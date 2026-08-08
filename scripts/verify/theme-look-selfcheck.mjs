import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

/** Mirrors lib/products/theme-look.ts (no TS loader). */
function asHex(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(trimmed);
  if (!match) {
    return null;
  }
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
  }
  return `#${hex.slice(0, 6)}`.toLowerCase();
}

function firstHex(...candidates) {
  for (const candidate of candidates) {
    const hex = asHex(candidate);
    if (hex) {
      return hex;
    }
  }
  return null;
}

function parseThemeColorsFromSettingsData(raw) {
  const data = JSON.parse(raw);
  const scheme = data.current.color_schemes["scheme-1"].settings;
  return {
    background: firstHex(scheme.background),
    buttonBg: firstHex(scheme.button),
  };
}

function parseTemplateSections(raw) {
  const data = JSON.parse(raw);
  const order = data.order;
  const sections = [];
  for (const key of order) {
    const section = data.sections[key];
    if (!section || section.disabled) {
      continue;
    }
    sections.push({
      type: section.type,
      label: section.name || section.type,
      kind: String(section.type).includes("main-product")
        ? "product_main"
        : "content",
    });
  }
  return sections;
}

export async function runThemeLookSelfCheck() {
  const root = getRoot();
  assert.equal(
    existsSync(join(root, "lib/products/theme-look.ts")),
    true,
    "theme-look.ts missing",
  );
  assert.equal(
    existsSync(join(root, "lib/products/theme-templates.ts")),
    true,
    "theme-templates.ts missing",
  );

  const colors = parseThemeColorsFromSettingsData(
    JSON.stringify({
      current: {
        color_schemes: {
          "scheme-1": {
            settings: {
              background: "#ffffff",
              button: "#222222",
            },
          },
        },
      },
    }),
  );
  assert.equal(colors.background, "#ffffff");
  assert.equal(colors.buttonBg, "#222222");

  const sections = parseTemplateSections(
    JSON.stringify({
      sections: {
        main: { type: "main-product" },
        story: { type: "rich-text", name: "Story" },
        skip: { type: "apps", disabled: true },
      },
      order: ["main", "story", "skip"],
    }),
  );
  assert.equal(sections.length, 2);
  assert.equal(sections[0].kind, "product_main");
  assert.equal(sections[1].label, "Story");

  // Slot order mirrors Dawn-like product.json block_order
  const template = {
    sections: {
      main: {
        type: "main-product",
        blocks: {
          title: { type: "title" },
          price: { type: "price" },
          buy: { type: "buy_buttons" },
          care: {
            type: "collapsible_tab",
            settings: {
              heading: "Care",
              content: "{{ product.metafields.custom.care_guide.value }}",
            },
          },
        },
        block_order: ["title", "price", "buy", "care"],
      },
    },
    order: ["main"],
  };
  const blocks = template.sections.main.block_order;
  assert.deepEqual(blocks, ["title", "price", "buy", "care"]);
  assert.match(
    template.sections.main.blocks.care.settings.content,
    /product\.metafields\.custom\.care_guide/,
  );
}
