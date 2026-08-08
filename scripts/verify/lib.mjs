import { appendFileSync, accessSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const LOG_PATH = join(ROOT, "docs/verification/agent-log.md");
const RETRY_DELAY_MS = 3000;
const DEFAULT_MAX_ATTEMPTS = 3;

export function getRoot() {
  return ROOT;
}

function timestamp() {
  return new Date().toISOString();
}

export function log(line) {
  const message = `[${timestamp()}] ${line}`;
  console.log(message);
  return message;
}

export function initAgentLog(phase) {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  const header = `\n---\n\n## Run ${timestamp()} — ${phase}\n\n`;
  appendFileSync(LOG_PATH, header, "utf8");
}

export function appendAgentLog(line) {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  appendFileSync(LOG_PATH, `${line}\n`, "utf8");
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithRetry(name, fn, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    log(`ATTEMPT ${attempt}/${maxAttempts} — ${name}`);
    appendAgentLog(`- ATTEMPT ${attempt}/${maxAttempts} — ${name}`);

    try {
      const result = await fn();
      log(`PASS — ${name}`);
      appendAgentLog(`- **PASS** — ${name}`);
      return { pass: true, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`FAIL — ${name}: ${message}`);
      appendAgentLog(`- FAIL — ${name}: ${message}`);

      if (attempt === maxAttempts) {
        return { pass: false, error: message };
      }

      log(`RETRY in ${RETRY_DELAY_MS}ms…`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  return { pass: false, error: "Unknown verification failure" };
}

export function assertExists(relativePath, label) {
  const fullPath = join(ROOT, relativePath);
  try {
    accessSync(fullPath);
    const stat = statSync(fullPath);
    if (!stat.isFile() && !stat.isDirectory()) {
      throw new Error(`${label ?? relativePath} is not a file or directory`);
    }
  } catch {
    throw new Error(`Missing ${label ?? relativePath}`);
  }
}

export async function runCommand(command, args, label) {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${label} exited ${code}\n${stderr.trim() || stdout.trim()}`,
        ),
      );
    });
  });
}

export function writeSummary(phase, results) {
  const passed = results.filter((item) => item.pass).length;
  const failed = results.filter((item) => !item.pass);
  const summary = [
    `**Summary:** ${passed}/${results.length} checks passed`,
    failed.length
      ? `**Blockers:** ${failed.map((item) => item.name).join(", ")}`
      : "**Status:** All automated checks passed",
  ].join("\n");

  appendAgentLog(summary);
  return summary;
}

export function ensureAgentLogPreamble() {
  mkdirSync(dirname(LOG_PATH), { recursive: true });
  try {
    accessSync(LOG_PATH);
  } catch {
    writeFileSync(
      LOG_PATH,
      "# Agent verification log\n\nAutomated runs append below. Agents retry failed checks up to 3 times.\n",
      "utf8",
    );
  }
}
