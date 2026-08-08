import { runApplyColumnMapSelfCheck } from "./apply-column-map-selfcheck.mjs";
import { runAiMapHeuristicSelfCheck } from "./ai-map-heuristic-selfcheck.mjs";
import { runArthenicDecorSelfCheck } from "./arthenic-decor-selfcheck.mjs";
import { runExcelParseSelfCheck } from "./excel-parse-selfcheck.mjs";
import { runImportPromptPackSelfCheck } from "./import-prompt-pack-selfcheck.mjs";
import { runSystemPromptSelfCheck } from "./system-prompt-selfcheck.mjs";
import { runTransformEngineSelfCheck } from "./transform-engine-selfcheck.mjs";
import { runMergeKvSelfCheck } from "./merge-selfcheck.mjs";

export async function runImportSelfCheck() {
  await runImportPromptPackSelfCheck();
  await runSystemPromptSelfCheck();
  await runTransformEngineSelfCheck();
  await runMergeKvSelfCheck();
  await runExcelParseSelfCheck();
  await runApplyColumnMapSelfCheck();
  await runAiMapHeuristicSelfCheck();
  await runArthenicDecorSelfCheck();
}
