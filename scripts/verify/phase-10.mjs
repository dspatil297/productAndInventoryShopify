import { standardPhaseChecks } from "./common.mjs";
import { runMetafieldWidgetsSelfCheck } from "./metafield-widgets-selfcheck.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 10 — Smart metafield forms";
const CHECKLIST = "docs/verification/phase-10-checklist.md";

const REQUIRED_FILES = [
  "lib/metafields/display.ts",
  "lib/metafields/validators.ts",
  "components/merchant/MetafieldWidget.tsx",
  "components/merchant/MetafieldCell.tsx",
  "components/merchant/MetafieldField.tsx",
  "components/merchant/ProductForm.tsx",
  "components/merchant/ProductImportPanel.tsx",
  "docs/verification/phase-10-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: [
    ...standardPhaseChecks(REQUIRED_FILES),
    {
      name: "Metafield widgets self-check",
      fn: runMetafieldWidgetsSelfCheck,
    },
  ],
});
