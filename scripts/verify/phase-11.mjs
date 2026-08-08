import { standardPhaseChecks } from "./common.mjs";
import { runProductGidSelfCheck } from "./product-gid-selfcheck.mjs";
import { runThemeLookSelfCheck } from "./theme-look-selfcheck.mjs";
import { runStructuredJsonSelfCheck } from "./structured-json-selfcheck.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 11 — PDP preview editor";
const CHECKLIST = "docs/verification/phase-11-checklist.md";

const REQUIRED_FILES = [
  "lib/products/theme-templates.ts",
  "lib/products/theme-look.ts",
  "lib/metafields/structured-json.ts",
  "components/merchant/PairListField.tsx",
  "components/merchant/JsonObjectField.tsx",
  "public/pair-list.js",
  "public/json-object.js",
  "lib/products/pdp-canvas-plan.ts",
  "lib/products/heritage-metafields.ts",
  "app/merchant/products/sync-templates/actions.ts",
  "components/merchant/HeritagePdpCanvas.tsx",
  "components/merchant/VisualProductFlow.tsx",
  "components/merchant/ProductEditForm.tsx",
  "components/merchant/ProductEditShell.tsx",
  "app/merchant/products/[id]/page.tsx",
  "app/merchant/products/[id]/actions.ts",
  "app/merchant/products/new/visual-actions.ts",
  "public/visual-pdp.js",
  "docs/verification/phase-11-checklist.md",
];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: [
    ...standardPhaseChecks(REQUIRED_FILES),
    {
      name: "Theme look parser self-check",
      fn: runThemeLookSelfCheck,
    },
    {
      name: "Structured JSON pair self-check",
      fn: runStructuredJsonSelfCheck,
    },
    {
      name: "Product GID self-check",
      fn: runProductGidSelfCheck,
    },
  ],
});
