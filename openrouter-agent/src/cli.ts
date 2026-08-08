import { createInterface } from "node:readline";
import { runAgentWithRetry } from "./agent.js";
import { loadConfig } from "./config.js";
import {
  dispatch,
  registerDefaultCommands,
  type CommandContext,
} from "./commands.js";
import { borderedReadLine, plainReadLine, styledReadLine } from "./input-styles.js";
import { Loader } from "./loader.js";
import { TuiRenderer } from "./renderer.js";
import {
  initSessionDir,
  loadSession,
  newSessionPath,
  saveMessage,
} from "./session.js";
import { detectBg } from "./terminal-bg.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const GRAY = "\x1b[90m";
const YELLOW = "\x1b[33m";

function formatTokens(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

function writeCwdStatus(): void {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const cwd = process.cwd().replace(home, "~");
  process.stdout.write(`\x1b[K  ${DIM}${cwd}${RESET}\n`);
}

async function main() {
  const config = loadConfig();
  const bgInput = config.display.inputStyle === "block" ? await detectBg() : "";

  registerDefaultCommands();

  initSessionDir(config.sessionDir);
  let sessionPath = newSessionPath(config.sessionDir);
  const messages = loadSession(sessionPath) as Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;

  const width = Math.min(process.stdout.columns || 60, 60);
  const line = `${GRAY}${"─".repeat(width)}${RESET}`;
  console.log(`\n${line}`);
  console.log(`  ${BOLD}OpenRouter Agent${RESET}  ${DIM}v0.1.0${RESET}`);
  console.log(`  ${DIM}model${RESET}  ${CYAN}${config.model}${RESET}`);
  if (config.slashCommands) {
    console.log(`  ${DIM}/model · /new · /help · exit${RESET}`);
  }
  console.log(`${line}\n`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${GREEN}>${RESET} `,
  });

  const cmdCtx: CommandContext = {
    config,
    rl,
    messages,
    sessionPath,
    resetSession: () => {
      sessionPath = newSessionPath(config.sessionDir);
      return sessionPath;
    },
    totalTokens: { input: 0, output: 0 },
  };

  async function getInput(): Promise<string> {
    switch (config.display.inputStyle) {
      case "block":
        return styledReadLine(bgInput);
      case "bordered":
        return borderedReadLine();
      case "plain":
      default:
        return plainReadLine(rl, `${GREEN}>${RESET} `);
    }
  }

  const renderer = new TuiRenderer({ display: config.display });
  const loader = new Loader(config.display.loader);

  while (true) {
    const input = await getInput();
    const trimmed = input.trim();
    if (!trimmed) {
      continue;
    }

    if (config.display.inputStyle !== "plain") {
      writeCwdStatus();
    }

    if (trimmed.toLowerCase() === "exit") {
      process.exit(0);
    }

    if (config.slashCommands && trimmed.startsWith("/")) {
      await dispatch(trimmed, cmdCtx);
      continue;
    }

    console.log();
    messages.push({ role: "user", content: trimmed });
    saveMessage(sessionPath, { role: "user", content: trimmed });

    let started = false;
    loader.start();

    try {
      const agentInput = messages.length > 1 ? messages : trimmed;
      const result = await runAgentWithRetry(config, agentInput, {
        onEvent: (event) => {
          if (!started) {
            started = true;
            loader.stop();
          }
          renderer.handle(event);
        },
      });

      loader.stop();
      renderer.endTurn();

      messages.push({ role: "assistant", content: result.text });
      saveMessage(sessionPath, { role: "assistant", content: result.text });

      cmdCtx.totalTokens.input += result.usage?.inputTokens ?? 0;
      cmdCtx.totalTokens.output += result.usage?.outputTokens ?? 0;

      const inT = result.usage?.inputTokens ?? 0;
      const outT = result.usage?.outputTokens ?? 0;
      console.log(`\n${GRAY}  ${formatTokens(inT)} in · ${formatTokens(outT)} out${RESET}\n`);
    } catch (error: unknown) {
      loader.stop();
      renderer.endTurn();
      const message = error instanceof Error ? error.message : "Unknown error";
      console.log(`\n${YELLOW}  Error: ${message}${RESET}\n`);
    }
  }
}

main();
