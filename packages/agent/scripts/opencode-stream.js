#!/usr/bin/env node
const readline = require("node:readline");

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

const writeLine = (value) => {
  process.stdout.write(`${value}\n`);
};

const formatToolLine = (tool, title, input) => {
  if (title) return `[tool] ${tool}: ${title}`;
  if (input && Object.keys(input).length > 0) {
    return `[tool] ${tool}: ${JSON.stringify(input)}`;
  }
  return `[tool] ${tool}`;
};

rl.on("line", (line) => {
  if (!line.trim()) return;
  let payload;
  try {
    payload = JSON.parse(line);
  } catch {
    return;
  }

  if (payload.type === "text" && payload.part?.text) {
    process.stdout.write(payload.part.text);
    if (!payload.part.text.endsWith("\n")) {
      process.stdout.write("\n");
    }
    return;
  }

  if (payload.type === "tool_use" && payload.part) {
    const tool = payload.part.tool ?? "tool";
    const title = payload.part.state?.title ?? "";
    const input = payload.part.state?.input ?? {};
    writeLine(formatToolLine(tool, title, input));
    return;
  }

  if (payload.type === "error" && payload.error) {
    const name = payload.error?.name ?? "error";
    const message = payload.error?.data?.message ?? payload.error?.message ?? "";
    writeLine(`[error] ${name}${message ? `: ${message}` : ""}`);
    return;
  }
});
