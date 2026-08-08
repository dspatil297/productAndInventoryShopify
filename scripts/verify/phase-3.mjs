import { standardPhaseChecks } from "./common.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 3 — Product list + search";
const CHECKLIST = "docs/verification/phase-3-checklist.md";

const REQUIRED_FILES = [
  "app/api/shops/[shopId]/products/route.ts",
  "app/app/products/page.tsx",
  "app/agency/(protected)/stores/[shopId]/products/page.tsx",
  "components/merchant/ProductTable.tsx",
  "components/shared/QueryProvider.tsx",
  "lib/products/list-products.ts",
  "lib/products/config.ts",
  "lib/products/types.ts",
  "lib/shops/api-access.ts",
  "lib/shopify/queries.ts",
  "docs/verification/phase-3-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: standardPhaseChecks(REQUIRED_FILES),
});
