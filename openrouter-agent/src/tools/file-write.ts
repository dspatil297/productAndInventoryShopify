import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

export const fileWriteTool = tool({
  name: "file_write",
  description: "Write content to a file, creating parent directories if needed.",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file"),
    content: z.string().describe("File content"),
  }),
  execute: async ({ path, content }) => {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf-8");
      return { written: true, path };
    } catch (error: unknown) {
      const err = error as Error;
      return { error: err.message };
    }
  },
});
