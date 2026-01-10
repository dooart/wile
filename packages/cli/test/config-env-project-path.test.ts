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

test("config records custom env project path", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CC",
      "oauth",
      "oauth-token",
      "sonnet",
      "local",
      ".env.local",
      "main",
      12
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.WILE_ENV_PROJECT_PATH).toBe(".env.local");
  });
});
