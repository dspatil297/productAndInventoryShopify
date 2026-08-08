import { standardPhaseChecks } from "./common.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 6 — Inventory manager";
const CHECKLIST = "docs/verification/phase-6-checklist.md";

const REQUIRED_FILES = [
  "app/api/shops/[shopId]/locations/route.ts",
  "app/api/shops/[shopId]/inventory/route.ts",
  "app/api/shops/[shopId]/inventory/set/route.ts",
  "app/api/shops/[shopId]/inventory/adjust/route.ts",
  "app/api/shops/[shopId]/inventory/export/route.ts",
  "app/api/shops/[shopId]/inventory/move/route.ts",
  "app/merchant/inventory/page.tsx",
  "app/agency/(protected)/stores/[shopId]/inventory/page.tsx",
  "components/merchant/InventoryGrid.tsx",
  "components/merchant/LocationSwitcher.tsx",
  "lib/inventory/list-inventory.ts",
  "lib/inventory/set-quantities.ts",
  "lib/inventory/adjust-quantities.ts",
  "lib/inventory/move-quantities.ts",
  "docs/verification/phase-6-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: standardPhaseChecks(REQUIRED_FILES),
});
