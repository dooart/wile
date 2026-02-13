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

const writeTextChunk = (text: string): void => {
  process.stdout.write(text);
  if (!text.endsWith("\n")) {
    process.stdout.write("\n");
  }
};

const extractText = (content: unknown): void => {
  if (!Array.isArray(content)) {
    return;
  }

  for (const rawChunk of content) {
    if (!isObject(rawChunk)) {
      continue;
    }

    const chunkType = getString(rawChunk, "type");
    if (chunkType === "text") {
      const text = getString(rawChunk, "text");
      if (text) {
        writeTextChunk(text);
      }
      continue;
    }

    if (chunkType === "thinking") {
      const thinking = getString(rawChunk, "thinking");
      if (thinking) {
        writeLine(`[thinking] ${thinking}`);
      }
    }
  }
};

const extractToolUse = (content: unknown): void => {
  if (!Array.isArray(content)) {
    return;
  }

  for (const rawChunk of content) {
    if (!isObject(rawChunk) || getString(rawChunk, "type") !== "tool_use") {
      continue;
    }

    const toolName = getString(rawChunk, "name") ?? "tool";
    const input = getObject(rawChunk, "input");
    const description = input ? getString(input, "description") ?? "" : "";
    const command = input ? getString(input, "command") ?? "" : "";

    if (description && command) {
      writeLine(`[tool] ${toolName}: ${description} (${command})`);
      continue;
    }
    if (command) {
      writeLine(`[tool] ${toolName}: ${command}`);
      continue;
    }
    if (description) {
      writeLine(`[tool] ${toolName}: ${description}`);
      continue;
    }
    writeLine(`[tool] ${toolName}`);
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

  const payloadType = getString(parsed, "type");

  if (payloadType === "system" && getString(parsed, "subtype") === "init") {
    const model = getString(parsed, "model") ?? "unknown";
    writeLine(`[system] model: ${model}`);
    return;
  }

  if (payloadType === "assistant") {
    const message = getObject(parsed, "message");
    if (!message) {
      return;
    }
    const content = message["content"];
    extractToolUse(content);
    extractText(content);
    return;
  }

  if (payloadType === "user") {
    const message = getObject(parsed, "message");
    const content = message ? message["content"] : undefined;
    if (!Array.isArray(content)) {
      return;
    }

    for (const rawChunk of content) {
      if (!isObject(rawChunk) || getString(rawChunk, "type") !== "tool_result") {
        continue;
      }

      const toolUseId = getString(rawChunk, "tool_use_id") ?? "unknown";
      const isError = rawChunk["is_error"] === true;
      writeLine(`[tool-result] ${toolUseId} ${isError ? "error" : "ok"}`);
    }
    return;
  }

  if (payloadType === "result") {
    const result = getString(parsed, "result");
    if (result) {
      writeLine(result);
    }
  }
});
