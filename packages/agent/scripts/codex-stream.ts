#!/usr/bin/env bun
import { createInterface } from "node:readline";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null;

const getString = (obj: JsonObject, key: string): string | undefined => {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
};

const getObject = (obj: JsonObject, key: string): JsonObject | undefined => {
  const value = obj[key];
  return isObject(value) ? value : undefined;
};

const writeLine = (value: string): void => {
  process.stdout.write(`${value}\n`);
};

const writeText = (text: string): void => {
  process.stdout.write(text);
  if (!text.endsWith("\n")) {
    process.stdout.write("\n");
  }
};

const formatChanges = (changes: unknown): string => {
  if (!Array.isArray(changes) || changes.length === 0) {
    return "";
  }

  const parts: string[] = [];
  for (const rawChange of changes) {
    if (!isObject(rawChange)) {
      continue;
    }
    const kind = getString(rawChange, "kind") ?? "update";
    const path = getString(rawChange, "path") ?? "unknown";
    parts.push(`${kind} ${path}`);
  }

  return parts.join(", ");
};

const rl = createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", (line: string) => {
  if (!line.trim()) {
    return;
  }

  if (process.env.WILE_STREAM_JSON === "true") {
    writeLine(line);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }

  if (!isObject(parsed)) {
    return;
  }

  const eventType = getString(parsed, "type");

  if (eventType === "thread.started") {
    const threadId = getString(parsed, "thread_id");
    if (threadId) {
      writeLine(`[system] thread: ${threadId}`);
    }
    return;
  }

  if (eventType === "turn.failed") {
    const error = getObject(parsed, "error");
    const message = error ? getString(error, "message") ?? "Unknown error" : "Unknown error";
    writeLine(`[error] ${message}`);
    return;
  }

  if (eventType === "error") {
    const message = getString(parsed, "message") ?? "Unknown error";
    writeLine(`[error] ${message}`);
    return;
  }

  const item = getObject(parsed, "item");
  if (!item) {
    return;
  }

  const itemType = getString(item, "type");

  if (eventType === "item.completed" && itemType === "agent_message") {
    const text = getString(item, "text");
    if (text) {
      writeText(text);
    }
    return;
  }

  if (eventType === "item.completed" && itemType === "reasoning") {
    writeLine(`[thinking] ${getString(item, "text") ?? ""}`);
    return;
  }

  if (itemType === "command_execution") {
    const command = getString(item, "command") ?? "command";
    if (eventType === "item.started") {
      writeLine(`[tool] shell: ${command}`);
      return;
    }

    if (eventType === "item.completed") {
      const status = getString(item, "status") ?? "completed";
      const exitCodeValue = item["exit_code"];
      const exitCode =
        typeof exitCodeValue === "number" || typeof exitCodeValue === "string"
          ? ` (exit ${String(exitCodeValue)})`
          : "";
      writeLine(`[tool-result] shell ${status}${exitCode}`);
      return;
    }
  }

  if (eventType === "item.completed" && itemType === "file_change") {
    const detail = formatChanges(item["changes"]);
    writeLine(`[tool] file_change${detail ? `: ${detail}` : ""}`);
    return;
  }

  if (itemType === "mcp_tool_call") {
    const server = getString(item, "server") ?? "mcp";
    const tool = getString(item, "tool") ?? "tool";

    if (eventType === "item.started") {
      writeLine(`[tool] mcp ${server}/${tool}`);
      return;
    }

    if (eventType === "item.completed") {
      const status = getString(item, "status") ?? "completed";
      writeLine(`[tool-result] mcp ${server}/${tool} ${status}`);
      return;
    }
  }

  if (itemType === "web_search" && eventType === "item.started") {
    const query = getString(item, "query") ?? "";
    writeLine(`[tool] web_search${query ? `: ${query}` : ""}`);
    return;
  }

  if (eventType === "item.completed" && itemType === "error") {
    writeLine(`[error] ${getString(item, "message") ?? "Unknown error"}`);
  }
});
