import { OpenRouter } from "@openrouter/agent";
import type { Item } from "@openrouter/agent";
import { maxCost, stepCountIs } from "@openrouter/agent/stop-conditions";
import type { AgentConfig } from "./config.js";
import { tools } from "./tools/index.js";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; callId: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; callId: string; output: string }
  | { type: "reasoning"; delta: string };

export async function runAgent(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: { onEvent?: (event: AgentEvent) => void; signal?: AbortSignal },
) {
  const client = new OpenRouter({ apiKey: config.apiKey });

  const result = client.callModel({
    model: config.model,
    instructions: config.systemPrompt.replace("{cwd}", process.cwd()),
    input: input as string | Item[],
    tools,
    stopWhen: [stepCountIs(config.maxSteps), maxCost(config.maxCost)],
  });

  if (options?.onEvent) {
    const textByItem = new Map<string, number>();
    const callNames = new Map<string, string>();

    for await (const item of result.getItemsStream()) {
      if (options.signal?.aborted) {
        break;
      }
      if (item.type === "message") {
        const text =
          item.content
            ?.filter((chunk): chunk is { type: "output_text"; text: string } => "text" in chunk)
            .map((chunk) => chunk.text)
            .join("") ?? "";
        const prev = textByItem.get(item.id) ?? 0;
        if (text.length > prev) {
          options.onEvent({ type: "text", delta: text.slice(prev) });
          textByItem.set(item.id, text.length);
        }
      } else if (item.type === "function_call") {
        callNames.set(item.callId, item.name);
        if (item.status === "completed") {
          const args = (() => {
            try {
              return item.arguments ? (JSON.parse(item.arguments) as Record<string, unknown>) : {};
            } catch {
              return {};
            }
          })();
          options.onEvent({
            type: "tool_call",
            name: item.name,
            callId: item.callId,
            args,
          });
        }
      } else if (item.type === "function_call_output") {
        const out =
          typeof item.output === "string" ? item.output : JSON.stringify(item.output);
        options.onEvent({
          type: "tool_result",
          name: callNames.get(item.callId) ?? "unknown",
          callId: item.callId,
          output: out.length > 200 ? `${out.slice(0, 200)}…` : out,
        });
      } else if (item.type === "reasoning") {
        const text = item.summary?.map((entry: { text: string }) => entry.text).join("") ?? "";
        if (text) {
          options.onEvent({ type: "reasoning", delta: text });
        }
      }
    }
  }

  const response = await result.getResponse();
  return {
    text: response.outputText ?? "",
    usage: response.usage,
    output: response.output,
  };
}

export async function runAgentWithRetry(
  config: AgentConfig,
  input: string | ChatMessage[],
  options?: {
    onEvent?: (event: AgentEvent) => void;
    signal?: AbortSignal;
    maxRetries?: number;
  },
) {
  const max = options?.maxRetries ?? 3;
  for (let attempt = 0; attempt <= max; attempt += 1) {
    try {
      return await runAgent(config, input, options);
    } catch (error: unknown) {
      const err = error as { status?: number; statusCode?: number };
      const status = err.status ?? err.statusCode;
      if (!(status === 429 || (status !== undefined && status >= 500 && status < 600)) || attempt === max) {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, Math.min(1000 * 2 ** attempt, 30000));
      });
    }
  }
  throw new Error("Unreachable");
}
