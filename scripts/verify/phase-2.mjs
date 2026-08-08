import { standardPhaseChecks } from "./common.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 2 — Merchant embedded shell";
const CHECKLIST = "docs/verification/phase-2-checklist.md";

const REQUIRED_FILES = [
  "app/app/layout.tsx",
  "app/app/page.tsx",
  "components/merchant/AppNav.tsx",
  "lib/shopify/session.ts",
  "app/app/products/page.tsx",
  "app/app/metafields/page.tsx",
  "app/app/inventory/page.tsx",
  "app/app/import/page.tsx",
  "app/app/settings/page.tsx",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: standardPhaseChecks(REQUIRED_FILES),
});
