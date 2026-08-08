import { standardPhaseChecks } from "./common.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 5 — Merchant portal + thin embedded shell";
const CHECKLIST = "docs/verification/phase-5-checklist.md";

const REQUIRED_FILES = [
  "lib/merchant/auth.ts",
  "app/merchant/enter/route.ts",
  "app/merchant/layout.tsx",
  "app/merchant/products/page.tsx",
  "app/merchant/metafields/page.tsx",
  "components/merchant/MerchantDashboardNav.tsx",
  "components/merchant/MerchantPortalLaunch.tsx",
  "middleware.ts",
  "docs/verification/phase-5-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: standardPhaseChecks(REQUIRED_FILES),
});
