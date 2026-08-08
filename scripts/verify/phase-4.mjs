import { standardPhaseChecks } from "./common.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 4 — Metafield bulk editor";
const CHECKLIST = "docs/verification/phase-4-checklist.md";

const REQUIRED_FILES = [
  "app/api/shops/[shopId]/metafield-definitions/route.ts",
  "app/api/shops/[shopId]/metafield-definitions/refresh/route.ts",
  "app/api/shops/[shopId]/metafields/route.ts",
  "app/api/shops/[shopId]/metafields/save/route.ts",
  "app/api/shops/[shopId]/metafields/export/route.ts",
  "app/app/metafields/page.tsx",
  "app/agency/(protected)/stores/[shopId]/metafields/page.tsx",
  "components/merchant/MetafieldSpreadsheet.tsx",
  "components/merchant/MetafieldField.tsx",
  "lib/metafields/types.ts",
  "lib/metafields/config.ts",
  "lib/metafields/validators.ts",
  "lib/metafields/form-fields.ts",
  "lib/metafields/list-metafields.ts",
  "lib/metafields/set-metafields.ts",
  "lib/metafields/refresh-definitions.ts",
  "lib/metafields/export-csv.ts",
  "lib/metafields/search-params.ts",
  "lib/shopify/mutations.ts",
  "docs/verification/phase-4-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: standardPhaseChecks(REQUIRED_FILES),
});
