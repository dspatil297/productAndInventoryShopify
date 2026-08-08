import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

const execFileAsync = promisify(execFile);

export const grepTool = tool({
  name: "grep",
  description: "Search file contents by regex.",
  inputSchema: z.object({
    pattern: z.string().describe("Regex pattern to search for"),
    path: z.string().optional().describe("Directory or file to search (default: cwd)"),
    glob: z.string().optional().describe('File filter, e.g. "*.ts"'),
    ignoreCase: z.boolean().optional(),
  }),
  execute: async ({ pattern, path, glob: globFilter, ignoreCase }) => {
    const target = path ? resolve(path) : process.cwd();

    try {
      const args = ["--no-heading", "--line-number", "--max-count", "100"];
      if (ignoreCase) {
        args.push("-i");
      }
      if (globFilter) {
        args.push("--glob", globFilter);
      }
      args.push(pattern, target);
      const { stdout } = await execFileAsync("rg", args, { maxBuffer: 1024 * 1024 });
      const matches = stdout
        .split("\n")
        .filter(Boolean)
        .slice(0, 100)
        .map((line) => {
          const match = /^([^:]+):(\d+):(.*)$/.exec(line);
          if (!match) {
            return { file: target, line: 0, content: line };
          }
          return { file: match[1], line: Number.parseInt(match[2], 10), content: match[3] };
        });
      return { matches, count: matches.length };
    } catch {
      return nodeGrep(target, pattern, globFilter, ignoreCase ?? false);
    }
  },
});

async function nodeGrep(
  target: string,
  pattern: string,
  globFilter: string | undefined,
  ignoreCase: boolean,
): Promise<{ matches: Array<{ file: string; line: number; content: string }>; count: number }> {
  const regex = new RegExp(pattern, ignoreCase ? "i" : undefined);
  const matches: Array<{ file: string; line: number; content: string }> = [];
  const files = await collectFiles(target, globFilter);

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (regex.test(lines[index])) {
        matches.push({ file, line: index + 1, content: lines[index] });
        if (matches.length >= 100) {
          return { matches, count: matches.length };
        }
      }
    }
  }

  return { matches, count: matches.length };
}

async function collectFiles(target: string, globFilter?: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) {
    return [target];
  }

  const out: string[] = [];
  const entries = await readdir(target, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }
    const full = join(target, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full, globFilter)));
    } else if (!globFilter || entry.name.match(globFilter.replace("*", ".*"))) {
      out.push(full);
    }
    if (out.length >= 500) {
      break;
    }
  }
  return out;
}
