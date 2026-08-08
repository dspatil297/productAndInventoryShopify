import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

export async function runSystemPromptSelfCheck() {
  const root = getRoot();
  assert.equal(existsSync(join(root, "lib/import/system-prompt.ts")), true);

  const pack = {
    headers: ["title", "custom.color"],
    fields: [
      { header: "title", kind: "base", label: "Title", hint: "product title" },
      {
        header: "custom.color",
        kind: "metafield",
        namespace: "custom",
        key: "color",
        type: "single_line_text_field",
        label: "Color",
        hint: "plain text",
      },
    ],
  };

  const schemaLine = `- custom.color (single_line_text_field): Color. Format: plain text`;
  const prompt = [
    "You are a Shopify catalog mapping assistant for this store.",
    schemaLine,
    "custom.color",
  ].join("\n");

  assert.ok(prompt.includes("custom.color"));
  assert.ok(prompt.includes("Shopify catalog mapping assistant"));
  assert.equal(pack.fields.length, 2);
}
