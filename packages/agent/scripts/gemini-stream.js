#!/usr/bin/env node
const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

const writeLine = (value) => {
  process.stdout.write(`${value}\n`);
};

const writeContent = (content) => {
  if (typeof content !== "string") return;
  process.stdout.write(content);
  if (!content.endsWith("\n")) {
    process.stdout.write("\n");
  }
};

rl.on("line", (line) => {
  if (!line.trim()) return;
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return;
  }

  if (payload.type === "init") {
    const model = payload.model ?? "unknown";
    writeLine(`[system] model: ${model}`);
    return;
  }

  if (payload.type === "message") {
    if (payload.role === "assistant" && payload.content) {
      writeContent(payload.content);
    }
    return;
  }

  if (payload.type === "tool_use") {
    const tool = payload.tool_name ?? "tool";
    const params = payload.parameters ?? {};
    const detail = Object.keys(params).length > 0 ? `: ${JSON.stringify(params)}` : "";
    writeLine(`[tool] ${tool}${detail}`);
    return;
  }

  if (payload.type === "tool_result") {
    const toolId = payload.tool_id ?? "unknown";
    const status = payload.status ?? "unknown";
    writeLine(`[tool-result] ${toolId} ${status}`);
    return;
  }

  if (payload.type === "error") {
    const message =
      payload.message ?? payload.error?.message ?? payload.error ?? "Unknown error";
    writeLine(`[error] ${message}`);
  }
});
