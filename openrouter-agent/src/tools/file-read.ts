import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_CHARS = 2000;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export const fileReadTool = tool({
  name: "file_read",
  description:
    "Read the contents of a file. Output is capped at 2000 lines by default (use offset/limit to paginate) and any line longer than 2000 characters is truncated.",
  inputSchema: z.object({
    path: z.string().describe("Absolute path to the file"),
    offset: z.number().optional().describe("Start reading from this line (1-indexed)"),
    limit: z.number().optional().describe(`Maximum lines to return (default ${DEFAULT_LINE_LIMIT})`),
  }),
  execute: async ({ path, offset, limit }) => {
    const ext = extname(path).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      const data = await readFile(path);
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".gif"
            ? "image/gif"
            : ext === ".webp"
              ? "image/webp"
              : "image/jpeg";
      return { type: "image", data: data.toString("base64"), mimeType };
    }

    try {
      const content = await readFile(path, "utf-8");
      const lines = content.split("\n");
      const start = offset ? offset - 1 : 0;
      const end = Math.min(start + (limit ?? DEFAULT_LINE_LIMIT), lines.length);
      let longLines = 0;
      const slice = lines.slice(start, end).map((line) => {
        if (line.length <= MAX_LINE_CHARS) {
          return line;
        }
        longLines += 1;
        return `${line.slice(0, MAX_LINE_CHARS)}… [line truncated, ${line.length - MAX_LINE_CHARS} chars dropped]`;
      });
      const tailTruncated = end < lines.length;
      const truncated = tailTruncated || longLines > 0;
      const hintParts: string[] = [`Showing lines ${start + 1}-${end} of ${lines.length}.`];
      if (tailTruncated) {
        hintParts.push(`Use offset=${end + 1} to continue.`);
      }
      if (longLines > 0) {
        hintParts.push(
          `${longLines} line(s) exceeded ${MAX_LINE_CHARS} chars and were per-line truncated; use grep to fetch content from those lines.`,
        );
      }

      return {
        content: slice.join("\n"),
        totalLines: lines.length,
        ...(truncated && {
          truncated: true,
          ...(tailTruncated && { nextOffset: end + 1 }),
          hint: hintParts.join(" "),
        }),
      };
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        return { error: `File not found: ${path}` };
      }
      if (err.code === "EACCES") {
        return { error: `Permission denied: ${path}` };
      }
      return { error: err.message ?? "Read failed" };
    }
  },
});
