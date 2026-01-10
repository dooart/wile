#!/usr/bin/env node
const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

const writeLine = (value) => {
  process.stdout.write(`${value}\n`);
};

rl.on("line", (line) => {
  if (!line.trim()) return;
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return;
  }

  const type = payload.type;

  // thread.started
  if (type === "thread.started") {
    const threadId = payload.thread_id ?? "unknown";
    writeLine(`[system] thread: ${threadId}`);
    return;
  }

  // turn.started
  if (type === "turn.started") {
    writeLine(`[turn] started`);
    return;
  }

  // turn.completed
  if (type === "turn.completed") {
    const usage = payload.usage ?? {};
    writeLine(`[turn] completed (input: ${usage.input_tokens ?? 0}, output: ${usage.output_tokens ?? 0})`);
    return;
  }

  // turn.failed
  if (type === "turn.failed") {
    const message = payload.error?.message ?? "unknown error";
    writeLine(`[turn] failed: ${message}`);
    return;
  }

  // error
  if (type === "error") {
    const message = payload.message ?? "unknown error";
    writeLine(`[error] ${message}`);
    return;
  }

  // item.started, item.completed, item.updated
  if (type === "item.started" || type === "item.completed" || type === "item.updated") {
    const item = payload.item;
    if (!item) return;

    const itemType = item.type;

    // agent_message
    if (itemType === "agent_message") {
      const text = item.text ?? "";
      if (text) {
        process.stdout.write(text);
        if (!text.endsWith("\n")) {
          process.stdout.write("\n");
        }
      }
      return;
    }

    // reasoning
    if (itemType === "reasoning") {
      const text = item.text ?? "";
      if (text) {
        writeLine(`[thinking] ${text}`);
      }
      return;
    }

    // command_execution
    if (itemType === "command_execution") {
      const command = item.command ?? "";
      const status = item.status ?? "in_progress";
      const exitCode = item.exit_code;
      if (type === "item.started") {
        writeLine(`[tool] shell: ${command}`);
      } else if (type === "item.completed") {
        const exitInfo = exitCode !== null && exitCode !== undefined ? ` (exit ${exitCode})` : "";
        writeLine(`[tool-result] shell ${status}${exitInfo}`);
      }
      return;
    }

    // file_change
    if (itemType === "file_change") {
      const changes = item.changes ?? [];
      const status = item.status ?? "in_progress";
      if (type === "item.completed" && changes.length > 0) {
        const files = changes.map(c => c.path).join(", ");
        writeLine(`[tool] file_change: ${files} (${status})`);
      }
      return;
    }

    // mcp_tool_call
    if (itemType === "mcp_tool_call") {
      const server = item.server ?? "";
      const tool = item.tool ?? "";
      const status = item.status ?? "in_progress";
      if (type === "item.started") {
        writeLine(`[tool] mcp:${server}/${tool}`);
      } else if (type === "item.completed") {
        writeLine(`[tool-result] mcp:${server}/${tool} ${status}`);
      }
      return;
    }

    // web_search
    if (itemType === "web_search") {
      const query = item.query ?? "";
      writeLine(`[tool] web_search: ${query}`);
      return;
    }

    // todo_list
    if (itemType === "todo_list") {
      const items = item.items ?? [];
      if (items.length > 0) {
        const completed = items.filter(i => i.completed).length;
        writeLine(`[plan] ${completed}/${items.length} tasks complete`);
      }
      return;
    }

    // error item
    if (itemType === "error") {
      const message = item.message ?? "unknown error";
      writeLine(`[error] ${message}`);
      return;
    }
  }
});
