import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseExcelBuffer } from "../../lib/import/excel-parse";
import { heuristicMappingConfig } from "../../lib/import/spec/mapping-ai";
import {
  applyArthenicColumnProfile,
  ensureCoreMappings,
} from "../../lib/import/spec/mapping-resolve";
import { buildProductDrafts } from "../../lib/import/spec/transform-engine";
import { DEFAULT_IMPORT_POLICY } from "../../lib/import/spec/import-policy";
import type { StoreSchema } from "../../lib/import/spec/types";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");

async function main() {
  const buf = readFileSync(
    join(root, "ProductsUpload/ProductData/Arthenic_Decor_Data.xlsx"),
  );
  const table = parseExcelBuffer(buf);
  const schema: StoreSchema = {
    schema_version: 1,
    shop: "test.myshopify.com",
    discovered_at: new Date().toISOString(),
    product_templates: ["sculpture"],
    metafields: [],
  };

  let mapping = heuristicMappingConfig(table, schema);
  mapping = applyArthenicColumnProfile(table, mapping);
  mapping = ensureCoreMappings(table, mapping);

  const drafts = buildProductDrafts(
    table,
    mapping,
    schema,
    DEFAULT_IMPORT_POLICY,
  );

  const bad = drafts.filter(
    (draft) => draft.errors.length > 0 || !draft.title || !draft.handle,
  );
  if (bad.length > 0) {
    console.error("failed rows", bad.length, bad[0]);
    process.exit(1);
  }

  console.log(
    "OK",
    drafts.length,
    "rows;",
    "first:",
    drafts[0]?.title,
    drafts[0]?.handle,
    "metafields:",
    drafts[0]?.metafields.length,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
