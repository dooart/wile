#!/usr/bin/env node
const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

const writeLine = (value) => {
  process.stdout.write(`${value}\n`);
};

const writeText = (text) => {
  if (typeof text !== "string") return;
  process.stdout.write(text);
  if (!text.endsWith("\n")) {
    process.stdout.write("\n");
  }
};

const formatChanges = (changes) => {
  if (!Array.isArray(changes) || changes.length === 0) return "";
  return changes
    .map((change) => `${change.kind ?? "update"} ${change.path ?? "unknown"}`)
    .join(", ");
};

rl.on("line", (line) => {
  if (!line.trim()) return;
  if (process.env.WILE_STREAM_JSON === "true") {
    writeLine(line);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return;
  }

  const type = payload.type;

  if (type === "thread.started") {
    if (payload.thread_id) {
      writeLine(`[system] thread: ${payload.thread_id}`);
    }
    return;
  }

  if (type === "turn.failed") {
    const message = payload.error?.message ?? "Unknown error";
    writeLine(`[error] ${message}`);
    return;
  }

  if (type === "error") {
    const message = payload.message ?? "Unknown error";
    writeLine(`[error] ${message}`);
    return;
  }

  if (!payload.item) return;

  const itemType = payload.item.type;

  if (type === "item.completed" && itemType === "agent_message") {
    writeText(payload.item.text);
    return;
  }

  if (type === "item.completed" && itemType === "reasoning") {
    writeLine(`[thinking] ${payload.item.text ?? ""}`);
    return;
  }

  if (itemType === "command_execution") {
    const command = payload.item.command ?? "command";
    if (type === "item.started") {
      writeLine(`[tool] shell: ${command}`);
      return;
    }
    if (type === "item.completed") {
      const status = payload.item.status ?? "completed";
      const exitCode =
        payload.item.exit_code !== undefined && payload.item.exit_code !== null
          ? ` (exit ${payload.item.exit_code})`
          : "";
      writeLine(`[tool-result] shell ${status}${exitCode}`);
      return;
    }
  }

  if (type === "item.completed" && itemType === "file_change") {
    const detail = formatChanges(payload.item.changes);
    writeLine(`[tool] file_change${detail ? `: ${detail}` : ""}`);
    return;
  }

  if (itemType === "mcp_tool_call") {
    const server = payload.item.server ?? "mcp";
    const tool = payload.item.tool ?? "tool";
    if (type === "item.started") {
      writeLine(`[tool] mcp ${server}/${tool}`);
      return;
    }
    if (type === "item.completed") {
      const status = payload.item.status ?? "completed";
      writeLine(`[tool-result] mcp ${server}/${tool} ${status}`);
      return;
    }
  }

  if (itemType === "web_search") {
    const query = payload.item.query ?? "";
    if (type === "item.started") {
      writeLine(`[tool] web_search${query ? `: ${query}` : ""}`);
    }
    return;
  }

  if (type === "item.completed" && itemType === "error") {
    writeLine(`[error] ${payload.item.message ?? "Unknown error"}`);
  }
});
