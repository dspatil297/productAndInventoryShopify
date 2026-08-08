import { glob } from "glob";
import { resolve } from "node:path";
import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

export const globTool = tool({
  name: "glob",
  description: "Find files by glob pattern.",
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern, e.g. "src/**/*.ts"'),
    path: z.string().optional().describe("Directory to search in (default: cwd)"),
  }),
  execute: async ({ pattern, path }) => {
    const cwd = path ? resolve(path) : process.cwd();
    const matches = (await glob(pattern, {
      cwd,
      nodir: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
    })).slice(0, 1000);
    return { matches, count: matches.length };
  },
});
