import { readFile, writeFile } from "node:fs/promises";
import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

export const fileEditTool = tool({
  name: "file_edit",
  description: "Apply search-and-replace edits to a file.",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file"),
    edits: z.array(
      z.object({
        old_text: z.string(),
        new_text: z.string(),
      }),
    ),
  }),
  execute: async ({ path, edits }) => {
    try {
      let content = await readFile(path, "utf-8");
      const original = content;

      for (const edit of edits) {
        const count = content.split(edit.old_text).length - 1;
        if (count === 0) {
          return { error: `old_text not found in ${path}` };
        }
        if (count > 1) {
          return { error: `old_text is ambiguous (${count} matches) in ${path}` };
        }
        content = content.replace(edit.old_text, edit.new_text);
      }

      await writeFile(path, content, "utf-8");
      return {
        written: true,
        path,
        diff: buildUnifiedDiff(path, original, content),
      };
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        return { error: `File not found: ${path}` };
      }
      return { error: err.message ?? "Edit failed" };
    }
  },
});

function buildUnifiedDiff(path: string, before: string, after: string): string {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  if (before === after) {
    return "";
  }
  return [
    `--- ${path}`,
    `+++ ${path}`,
    `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
    ...afterLines.map((line) => `+${line}`),
  ].join("\n");
}
