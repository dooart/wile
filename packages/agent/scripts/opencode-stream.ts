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

const formatToolLine = (tool: string, title: string, input: JsonObject): string => {
  if (title) {
    return `[tool] ${tool}: ${title}`;
  }
  if (Object.keys(input).length > 0) {
    return `[tool] ${tool}: ${JSON.stringify(input)}`;
  }
  return `[tool] ${tool}`;
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

  if (payloadType === "text") {
    const part = getObject(parsed, "part");
    const text = part ? getString(part, "text") : undefined;
    if (text) {
      process.stdout.write(text);
      if (!text.endsWith("\n")) {
        process.stdout.write("\n");
      }
    }
    return;
  }

  if (payloadType === "tool_use") {
    const part = getObject(parsed, "part");
    if (!part) {
      return;
    }

    const tool = getString(part, "tool") ?? "tool";
    const state = getObject(part, "state");
    const title = state ? getString(state, "title") ?? "" : "";
    const input = state ? getObject(state, "input") ?? {} : {};
    writeLine(formatToolLine(tool, title, input));
    return;
  }

  if (payloadType === "error") {
    const error = getObject(parsed, "error");
    if (!error) {
      return;
    }
    const name = getString(error, "name") ?? "error";
    const data = getObject(error, "data");
    const message =
      (data ? getString(data, "message") : undefined) ?? getString(error, "message") ?? "";
    writeLine(`[error] ${name}${message ? `: ${message}` : ""}`);
  }
});
