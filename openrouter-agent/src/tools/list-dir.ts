import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

export const listDirTool = tool({
  name: "list_dir",
  description: "List directory contents.",
  inputSchema: z.object({
    path: z.string().optional().describe("Directory path (default: cwd)"),
  }),
  execute: async ({ path }) => {
    const target = path ? resolve(path) : process.cwd();
    const entries = await readdir(target, { withFileTypes: true });
    const names = entries
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .sort()
      .slice(0, 500);
    return { path: target, entries: names, count: names.length };
  },
});
