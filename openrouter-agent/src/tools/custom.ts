import { tool } from "@openrouter/agent/tool";
import { z } from "zod";

export const customTool = tool({
  name: "my_tool",
  description: "Custom tool template — edit this for domain-specific actions.",
  inputSchema: z.object({
    param: z.string().describe("Description of the parameter"),
  }),
  execute: async ({ param }) => {
    return { result: "done", param };
  },
});
