import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertExists,
  getRoot,
  runCommand,
} from "./lib.mjs";

export async function checkNodeModules() {
  if (!existsSync(join(getRoot(), "node_modules"))) {
    throw new Error("node_modules missing — run npm install");
  }
}

export async function checkLint() {
  await runCommand("npm", ["run", "lint"], "eslint");
}

export async function checkBuild() {
  await runCommand("npm", ["run", "build"], "next build");
}

export function checkRequiredFiles(relativePaths) {
  return async () => {
    for (const file of relativePaths) {
      assertExists(file, file);
    }
  };
}

export function checkEnvExampleKeys(requiredKeys) {
  return async () => {
    const examplePath = join(getRoot(), ".env.example");
    const content = readFileSync(examplePath, "utf8");
    const missing = requiredKeys.filter((key) => !content.includes(`${key}=`));
    if (missing.length > 0) {
      throw new Error(`.env.example missing keys: ${missing.join(", ")}`);
    }
  };
}

/** Every phase script should include these unless explicitly skipped. */
export function standardPhaseChecks(requiredFiles = [], envKeys = []) {
  const checks = [
    { name: "node_modules present", fn: checkNodeModules },
    { name: "eslint", fn: checkLint },
    { name: "next build", fn: checkBuild },
  ];

  if (requiredFiles.length > 0) {
    checks.unshift({
      name: "Required phase files",
      fn: checkRequiredFiles(requiredFiles),
    });
  }

  if (envKeys.length > 0) {
    checks.splice(requiredFiles.length > 0 ? 1 : 0, 0, {
      name: ".env.example documents required keys",
      fn: checkEnvExampleKeys(envKeys),
    });
  }

  return checks;
}
