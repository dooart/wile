import { expect, test } from "bun:test";
import {
  ENV_FILE_KEY_ORDER,
  ENV_VAR_DOC,
  renderEnvDocMarkdown,
  splitEnv,
  toEnvString
} from "../src/lib/env-schema";

test("env schema keys are unique and ordered from docs", () => {
  const keysFromDocs = ENV_VAR_DOC.map((entry) => entry.key);
  expect(ENV_FILE_KEY_ORDER).toEqual(keysFromDocs);
  expect(new Set(keysFromDocs).size).toBe(keysFromDocs.length);
});

test("toEnvString preserves schema order and keeps unknown keys sorted", () => {
  const { known, extra } = splitEnv({
    CODEX_MODEL: "gpt-5.3-codex",
    CODING_AGENT: "CX",
    Z_EXTRA: "z",
    A_EXTRA: "a",
    WILE_REPO_SOURCE: "local"
  });

  const output = toEnvString(known, extra);
  const lines = output.trim().split("\n");
  expect(lines).toEqual([
    "CODING_AGENT=CX",
    "WILE_REPO_SOURCE=local",
    "CODEX_MODEL=gpt-5.3-codex",
    "A_EXTRA=a",
    "Z_EXTRA=z"
  ]);
});

test("markdown env doc lists every known key", () => {
  const doc = renderEnvDocMarkdown();
  for (const key of ENV_FILE_KEY_ORDER) {
    expect(doc.includes(`\`${key}\``)).toBe(true);
  }
});
