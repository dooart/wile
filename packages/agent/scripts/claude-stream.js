#!/usr/bin/env node
const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

const writeLine = (value) => {
  process.stdout.write(`${value}\n`);
};

const extractText = (content) => {
  if (!Array.isArray(content)) return;
  for (const chunk of content) {
    if (!chunk || typeof chunk !== "object") continue;
    if (chunk.type === "text" && typeof chunk.text === "string") {
      process.stdout.write(chunk.text);
      continue;
    }
    if (chunk.type === "thinking" && typeof chunk.thinking === "string") {
      writeLine(`[thinking] ${chunk.thinking}`);
    }
  }
};

const extractToolUse = (content) => {
  if (!Array.isArray(content)) return;
  for (const chunk of content) {
    if (!chunk || typeof chunk !== "object") continue;
    if (chunk.type === "tool_use") {
      const toolName = chunk.name ?? "tool";
      const description = chunk.input?.description ?? "";
      const command = chunk.input?.command ?? "";
      if (description && command) {
        writeLine(`[tool] ${toolName}: ${description} (${command})`);
      } else if (command) {
        writeLine(`[tool] ${toolName}: ${command}`);
      } else if (description) {
        writeLine(`[tool] ${toolName}: ${description}`);
      } else {
        writeLine(`[tool] ${toolName}`);
      }
    }
  }
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

  if (payload.type === "system" && payload.subtype === "init") {
    const model = payload.model ?? "unknown";
    writeLine(`[system] model: ${model}`);
    return;
  }

  if (payload.type === "assistant" && payload.message) {
    extractToolUse(payload.message.content);
    extractText(payload.message.content);
    return;
  }

  if (payload.type === "user" && payload.message?.content) {
    for (const chunk of payload.message.content) {
      if (chunk?.type === "tool_result") {
        writeLine(`[tool-result] ${chunk.tool_use_id ?? "unknown"} ${chunk.is_error ? "error" : "ok"}`);
      }
    }
    return;
  }

  if (payload.type === "result" && payload.result) {
    writeLine(payload.result);
  }
});
