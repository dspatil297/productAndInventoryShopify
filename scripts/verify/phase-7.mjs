import { standardPhaseChecks } from "./common.mjs";
import { runCsvSelfCheck } from "./csv-selfcheck.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 7 — Product create + CSV upload";
const CHECKLIST = "docs/verification/phase-7-checklist.md";

const REQUIRED_FILES = [
  "app/merchant/products/new/page.tsx",
  "app/api/shops/[shopId]/products/create/route.ts",
  "app/api/shops/[shopId]/upload/staged/route.ts",
  "app/merchant/import/page.tsx",
  "lib/csv/productImport.ts",
  "components/merchant/ProductForm.tsx",
  "lib/products/create-product.ts",
  "lib/products/staged-upload.ts",
  "app/api/shops/[shopId]/import/route.ts",
  "app/api/shops/[shopId]/import/template/route.ts",
  "docs/verification/phase-7-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: [
    ...standardPhaseChecks(REQUIRED_FILES),
    { name: "CSV import self-check", fn: runCsvSelfCheck },
  ],
});
