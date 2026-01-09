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

test("config writes OpenCode credentials when selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "OC",
      "sk-or-test",
      "glm-4.7",
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
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.OC_OPENROUTER_API_KEY).toBe("sk-or-test");
    expect(env.OC_MODEL).toBe("glm-4.7");
    expect(env.CC_CLAUDE_MODEL).toBeUndefined();
  });
});
