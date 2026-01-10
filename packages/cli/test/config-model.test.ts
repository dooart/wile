import { test, expect } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runConfig } from "../src/commands/config";
import { readEnvFile, withTempDir } from "./helpers";

const setInject = (values: unknown[]) => {
  process.env.WILE_PROMPTS_INJECT = JSON.stringify(values);
};

const clearInject = () => {
  delete process.env.WILE_PROMPTS_INJECT;
};

test("config writes selected Claude model", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CC",
      "oauth",
      "oauth-token",
      "opus",
      "github",
      "gh-token",
      "https://github.com/acme/test",
      "main",
      ".wile/.env.project",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CC_CLAUDE_MODEL).toBe("opus");
  });
});

test("config writes sonnet model when selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CC",
      "oauth",
      "oauth-token",
      "sonnet",
      "github",
      "gh-token",
      "https://github.com/acme/test",
      "main",
      ".wile/.env.project",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CC_CLAUDE_MODEL).toBe("sonnet");
  });
});

test("config writes haiku model when selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CC",
      "oauth",
      "oauth-token",
      "haiku",
      "github",
      "gh-token",
      "https://github.com/acme/test",
      "main",
      ".wile/.env.project",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CC_CLAUDE_MODEL).toBe("haiku");
  });
});

test("config writes max iterations when provided", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CC",
      "oauth",
      "oauth-token",
      "sonnet",
      "github",
      "gh-token",
      "https://github.com/acme/test",
      "main",
      ".wile/.env.project",
      42
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.WILE_MAX_ITERATIONS).toBe("42");
  });
});
