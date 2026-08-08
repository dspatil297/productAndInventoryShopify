import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { getRoot } from "./lib.mjs";

export async function runArthenicDecorSelfCheck() {
  const root = getRoot();
  const script = join(root, "scripts", "verify", "arthenic-decor-selfcheck.ts");
  const command = `npx --yes tsx "${script.replace(/"/g, '\\"')}"`;
  const result = spawnSync(command, {
    cwd: root,
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() ||
        result.stdout?.trim() ||
        "Arthenic decor self-check failed",
    );
  }
  assert.match(result.stdout ?? "", /OK 14 rows/);
}
