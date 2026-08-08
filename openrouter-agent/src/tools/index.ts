import { serverTool } from "@openrouter/agent";
import { customTool } from "./custom.js";
import { fileEditTool } from "./file-edit.js";
import { fileReadTool } from "./file-read.js";
import { fileWriteTool } from "./file-write.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { listDirTool } from "./list-dir.js";
import { shellTool } from "./shell.js";

export const tools = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  globTool,
  grepTool,
  listDirTool,
  shellTool,
  customTool,
  serverTool({ type: "openrouter:web_search" }),
  serverTool({ type: "openrouter:datetime", parameters: { timezone: "UTC" } }),
];
