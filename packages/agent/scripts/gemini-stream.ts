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

const writeContent = (content: string): void => {
  process.stdout.write(content);
  if (!content.endsWith("\n")) {
    process.stdout.write("\n");
  }
};

const rl = createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

rl.on("line", (line: string) => {
  if (!line.trim()) {
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

  const payloadType = getString(parsed, "type");

  if (payloadType === "init") {
    const model = getString(parsed, "model") ?? "unknown";
    writeLine(`[system] model: ${model}`);
    return;
  }

  if (payloadType === "message") {
    const role = getString(parsed, "role");
    const content = getString(parsed, "content");
    if (role === "assistant" && content) {
      writeContent(content);
    }
    return;
  }

  if (payloadType === "tool_use") {
    const tool = getString(parsed, "tool_name") ?? "tool";
    const params = getObject(parsed, "parameters");
    const detail = params && Object.keys(params).length > 0 ? `: ${JSON.stringify(params)}` : "";
    writeLine(`[tool] ${tool}${detail}`);
    return;
  }

  if (payloadType === "tool_result") {
    const toolId = getString(parsed, "tool_id") ?? "unknown";
    const status = getString(parsed, "status") ?? "unknown";
    writeLine(`[tool-result] ${toolId} ${status}`);
    return;
  }

  if (payloadType === "error") {
    const message =
      getString(parsed, "message") ??
      (() => {
        const error = getObject(parsed, "error");
        if (!error) {
          return undefined;
        }
        return getString(error, "message") ?? getString(error, "error");
      })() ??
      "Unknown error";

    writeLine(`[error] ${message}`);
  }
});
