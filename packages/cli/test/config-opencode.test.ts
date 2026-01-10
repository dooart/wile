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

test("config writes OpenCode with native provider (default)", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "OC",           // coding agent
      "native",       // provider
      "opencode/grok-code",  // model
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
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.OC_PROVIDER).toBe("native");
    expect(env.OC_MODEL).toBe("opencode/grok-code");
    expect(env.OC_OPENROUTER_API_KEY).toBeUndefined();
  });
});

test("config writes OpenCode with native provider and GLM model", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "OC",           // coding agent
      "native",       // provider
      "opencode/glm-4.7-free",  // model (index 2)
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
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.OC_PROVIDER).toBe("native");
    expect(env.OC_MODEL).toBe("opencode/glm-4.7-free");
    expect(env.OC_OPENROUTER_API_KEY).toBeUndefined();
  });
});

test("config writes OpenCode with openrouter provider", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "OC",           // coding agent
      "openrouter",   // provider
      "sk-or-test",   // api key
      "glm-4.7",      // model
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
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.OC_PROVIDER).toBe("openrouter");
    expect(env.OC_MODEL).toBe("glm-4.7");
    expect(env.OC_OPENROUTER_API_KEY).toBe("sk-or-test");
  });
});

test("config writes OpenCode with openrouter and local repo", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "OC",           // coding agent
      "openrouter",   // provider
      "sk-or-key",    // api key
      "glm-4.7",      // model
      "local",        // repo source
      "main",         // branch
      ".wile/.env.project",
      25
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.OC_PROVIDER).toBe("openrouter");
    expect(env.OC_MODEL).toBe("glm-4.7");
    expect(env.OC_OPENROUTER_API_KEY).toBe("sk-or-key");
    expect(env.WILE_REPO_SOURCE).toBe("local");
  });
});
