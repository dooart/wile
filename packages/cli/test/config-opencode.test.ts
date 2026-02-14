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

test("config writes OpenCode with default free model", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "OC", // coding agent
      "opencode/kimi-k2.5-free", // model
      "local", // repo source
      "main", // branch
      ".wile/.env.project",
      12,
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.OC_MODEL).toBe("opencode/kimi-k2.5-free");
  });
});

test("config writes OpenCode with selected free model", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "OC", // coding agent
      "opencode/glm-4.7-free", // model (index 2)
      "local", // repo source
      "main", // branch
      ".wile/.env.project",
      12,
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.OC_MODEL).toBe("opencode/glm-4.7-free");
  });
});
