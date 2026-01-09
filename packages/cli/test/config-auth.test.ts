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

test("config writes oauth token when oauth auth is selected", async () => {
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
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CC_CLAUDE_CODE_OAUTH_TOKEN).toBe("oauth-token");
    expect(env.CC_ANTHROPIC_API_KEY).toBeUndefined();
  });
});

test("config writes api key when api key auth is selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CC",
      "apiKey",
      "api-key-123",
      "sonnet",
      "github",
      "gh-token",
      "https://github.com/acme/test",
      "main",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CC_ANTHROPIC_API_KEY).toBe("api-key-123");
    expect(env.CC_CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
  });
});
