import type { Interface } from "node:readline";
import type { AgentConfig } from "./config.js";
import type { ChatMessage } from "./agent.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";

export interface CommandContext {
  config: AgentConfig;
  rl: Interface;
  messages: ChatMessage[];
  sessionPath: string;
  resetSession: () => string;
  totalTokens: { input: number; output: number };
}

export interface SlashCommand {
  name: string;
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<void>;
}

const commands: SlashCommand[] = [];

export function registerCommand(cmd: SlashCommand): void {
  commands.push(cmd);
}

export function getCommands(): SlashCommand[] {
  return commands;
}

export async function dispatch(input: string, ctx: CommandContext): Promise<boolean> {
  const [name, ...rest] = input.split(" ");
  const cmd = commands.find((entry) => entry.name === name);
  if (!cmd) {
    console.log(`  ${DIM}Unknown command: ${name}. Type /help for available commands.${RESET}`);
    return true;
  }
  await cmd.execute(rest.join(" "), ctx);
  return true;
}

function ask(rl: Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

export function registerDefaultCommands(): void {
  registerCommand({
    name: "/model",
    description: "Switch to a different model",
    execute: async (_args, ctx) => {
      console.log(`  ${DIM}Current:${RESET} ${CYAN}${ctx.config.model}${RESET}`);
      const query = await ask(ctx.rl, `  ${DIM}Search models:${RESET} `);
      if (!query.trim()) {
        return;
      }
      process.stdout.write(`  ${DIM}Fetching…${RESET}`);
      const res = await fetch("https://openrouter.ai/api/v1/models");
      const payload = (await res.json()) as {
        data: Array<{ id: string; name: string }>;
      };
      process.stdout.write("\r\x1b[K");
      const q = query.toLowerCase();
      const matches = payload.data
        .filter(
          (model) =>
            model.id.toLowerCase().includes(q) || model.name.toLowerCase().includes(q),
        )
        .slice(0, 15);
      if (!matches.length) {
        console.log(`  ${DIM}No models matching "${query}".${RESET}`);
        return;
      }
      matches.forEach((model, index) => {
        console.log(`  ${DIM}${String(index + 1).padStart(2)})${RESET} ${model.id}`);
      });
      const pick = await ask(ctx.rl, `\n  ${DIM}Select (1-${matches.length}):${RESET} `);
      const idx = Number.parseInt(pick, 10) - 1;
      if (idx >= 0 && idx < matches.length) {
        ctx.config.model = matches[idx].id;
        console.log(`  ${DIM}Model →${RESET} ${CYAN}${ctx.config.model}${RESET}`);
      } else {
        console.log(`  ${DIM}Cancelled.${RESET}`);
      }
    },
  });

  registerCommand({
    name: "/new",
    description: "Start a fresh conversation",
    execute: async (_args, ctx) => {
      ctx.messages.length = 0;
      ctx.sessionPath = ctx.resetSession();
      console.log(`  ${GREEN}✓${RESET} ${DIM}New session started.${RESET}`);
    },
  });

  registerCommand({
    name: "/help",
    description: "List available commands",
    execute: async () => {
      for (const cmd of getCommands()) {
        console.log(`  ${CYAN}${cmd.name.padEnd(12)}${RESET}${DIM}${cmd.description}${RESET}`);
      }
    },
  });
}
