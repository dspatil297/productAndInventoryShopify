import {
  appendAgentLog,
  ensureAgentLogPreamble,
  initAgentLog,
  log,
  runWithRetry,
  writeSummary,
} from "./lib.mjs";

/**
 * Run a phase verification suite with retry + agent log append.
 * @param {{ phase: string, checklistPath: string, checks: Array<{ name: string, fn: () => Promise<unknown> }> }} config
 */
export async function runPhaseVerification(config) {
  ensureAgentLogPreamble();
  initAgentLog(config.phase);
  log(`START — ${config.phase} automated verification`);

  const results = [];
  for (const check of config.checks) {
    const outcome = await runWithRetry(check.name, check.fn);
    results.push({ name: check.name, pass: outcome.pass, error: outcome.error });
  }

  const summary = writeSummary(config.phase, results);
  log(summary.replace(/\*\*/g, ""));

  appendAgentLog(`User checklist: ${config.checklistPath}`);

  const failed = results.filter((item) => !item.pass);
  if (failed.length > 0) {
    log(`DONE — ${failed.length} check(s) still failing after retries`);
    process.exit(1);
  }

  log("DONE — all automated checks passed");
  process.exit(0);
}
