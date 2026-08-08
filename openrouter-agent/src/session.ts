import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

export type SessionMessage = { role: string; content: string; [key: string]: unknown };

interface SessionEntry {
  timestamp: string;
  message: SessionMessage;
}

export function initSessionDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function saveMessage(sessionPath: string, message: SessionMessage): void {
  const entry: SessionEntry = {
    timestamp: new Date().toISOString(),
    message,
  };
  appendFileSync(sessionPath, `${JSON.stringify(entry)}\n`);
}

export function loadSession(sessionPath: string): SessionMessage[] {
  if (!existsSync(sessionPath)) {
    return [];
  }

  return readFileSync(sessionPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        const entry = JSON.parse(line) as SessionEntry;
        return entry.message;
      } catch {
        return null;
      }
    })
    .filter((message): message is SessionMessage => message !== null);
}

export function listSessions(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((file) => file.endsWith(".jsonl"))
    .sort();
}

export function newSessionPath(dir: string): string {
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  return join(dir, `${id}.jsonl`);
}
