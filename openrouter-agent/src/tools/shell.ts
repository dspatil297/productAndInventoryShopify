import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_SEC = 120;
const MAX_OUTPUT_CHARS = 256 * 1024;

export const shellTool = tool({
  name: "shell",
  description: "Execute a shell command and return output.",
  inputSchema: z.object({
    command: z.string().describe("Shell command to execute"),
    timeout: z.number().optional().describe("Timeout in seconds (default: 120)"),
  }),
  execute: async ({ command, timeout }) => {
    const seconds = timeout ?? DEFAULT_TIMEOUT_SEC;
    const shell = process.env.SHELL || (process.platform === "win32" ? "cmd.exe" : "/bin/bash");
    const shellArgs =
      process.platform === "win32" ? ["/c", command] : ["-lc", command];

    try {
      const { stdout, stderr } = await execFileAsync(shell, shellArgs, {
        timeout: seconds * 1000,
        maxBuffer: MAX_OUTPUT_CHARS,
        encoding: "utf-8",
      });
      const output = truncateOutput(`${stdout}${stderr}`);
      return { output, exitCode: 0 };
    } catch (error: unknown) {
      const err = error as {
        killed?: boolean;
        code?: number;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      const output = truncateOutput(`${err.stdout ?? ""}${err.stderr ?? ""}`);
      if (err.killed) {
        return { output, exitCode: err.code ?? 1, timedOut: true };
      }
      return { output: output || err.message || "Command failed", exitCode: err.code ?? 1 };
    }
  },
});

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_CHARS) {
    return output;
  }
  return output.slice(-MAX_OUTPUT_CHARS);
}
