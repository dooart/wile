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

test("config writes Codex with default model (o3)", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CX",           // coding agent
      "sk-test-key",  // api key
      "o3",           // model
      "local",        // repo source
      "main",         // branch
      ".wile/.env.project",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CODING_AGENT).toBe("CX");
    expect(env.CX_API_KEY).toBe("sk-test-key");
    expect(env.CX_MODEL).toBe("o3");
  });
});

test("config writes Codex with o4-mini model", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CX",           // coding agent
      "sk-test-key",  // api key
      "o4-mini",      // model (index 1)
      "local",        // repo source
      "main",         // branch
      ".wile/.env.project",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CODING_AGENT).toBe("CX");
    expect(env.CX_API_KEY).toBe("sk-test-key");
    expect(env.CX_MODEL).toBe("o4-mini");
  });
});

test("config writes Codex with gpt-4.1 model", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CX",           // coding agent
      "sk-test-key",  // api key
      "gpt-4.1",      // model (index 2)
      "local",        // repo source
      "main",         // branch
      ".wile/.env.project",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CODING_AGENT).toBe("CX");
    expect(env.CX_API_KEY).toBe("sk-test-key");
    expect(env.CX_MODEL).toBe("gpt-4.1");
  });
});

test("config writes Codex with GitHub repo source", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CX",           // coding agent
      "sk-test-key",  // api key
      "o3",           // model
      "github",       // repo source
      "gh-token",     // github token
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
    expect(env.CODING_AGENT).toBe("CX");
    expect(env.CX_API_KEY).toBe("sk-test-key");
    expect(env.CX_MODEL).toBe("o3");
    expect(env.WILE_REPO_SOURCE).toBe("github");
    expect(env.GITHUB_TOKEN).toBe("gh-token");
    expect(env.GITHUB_REPO_URL).toBe("https://github.com/acme/test");
  });
});
