import { standardPhaseChecks } from "./common.mjs";
import { runExcelPipelineSelfCheck } from "./excel-pipeline-selfcheck.mjs";
import { runImportSelfCheck } from "./import-selfcheck.mjs";
import { runPhaseVerification } from "./run-phase.mjs";

const PHASE = "Phase 12 — AI Excel mapper";
const CHECKLIST = "docs/verification/phase-12-checklist.md";

const REQUIRED_FILES = [
  "lib/import/prompt-pack.ts",
  "lib/import/system-prompt.ts",
  "lib/import/excel-parse.ts",
  "lib/import/apply-column-map.ts",
  "lib/import/ai-map-columns.ts",
  "lib/import/excel-pipeline.ts",
  "lib/import/deterministic-row-clean.ts",
  "lib/import/sync-prompt-pack.ts",
  "lib/import/spec/transform-engine.ts",
  "lib/import/spec/pipeline.ts",
  "lib/import/spec/theme-scan.ts",
  "lib/import/spec/mapping-resolve.ts",
  "lib/import/spec/import-sessions.ts",
  "lib/import/spec/stories.ts",
  "app/api/shops/[shopId]/import/excel-map/route.ts",
  "app/api/shops/[shopId]/import/excel-map/jobs/[jobId]/confirm/route.ts",
  "components/merchant/ProductImportPanel.tsx",
  "components/merchant/AiImportSection.tsx",
  "docs/verification/phase-12-checklist.md",
];

const AI_ENV_KEYS = ["AI_IMPORT_API_KEY", "AI_IMPORT_MODEL"];

await runPhaseVerification({
  phase: PHASE,
  checklistPath: CHECKLIST,
  checks: [
    ...standardPhaseChecks(REQUIRED_FILES, AI_ENV_KEYS),
    { name: "Import mapper self-check", fn: runImportSelfCheck },
    { name: "Excel pipeline self-check", fn: runExcelPipelineSelfCheck },
  ],
});
