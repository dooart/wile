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

test("config skips GitHub prompts when repo source is local", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CC",
      "oauth",
      "oauth-token",
      "sonnet",
      "local",
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
    expect(env.WILE_REPO_SOURCE).toBe("local");
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.GITHUB_REPO_URL).toBeUndefined();
  });
});

test("config captures GitHub credentials when repo source is github", async () => {
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
    expect(env.WILE_REPO_SOURCE).toBe("github");
    expect(env.GITHUB_TOKEN).toBe("gh-token");
    expect(env.GITHUB_REPO_URL).toBe("https://github.com/acme/test");
  });
});
