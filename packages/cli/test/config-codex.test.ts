import { test, expect } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runConfig } from "../src/commands/config";
import { readEnvFile, withTempDir } from "./helpers";

const setInject = (values: unknown[]) => {
  process.env.WILE_PROMPTS_INJECT = JSON.stringify(values);
};

const clearInject = () => {
  delete process.env.WILE_PROMPTS_INJECT;
};

test("config writes Codex auth.json when subscription auth is selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    const authPath = join(dir, "auth.json");
    const auth = JSON.stringify({ OPENAI_API_KEY: "sk-test" }, null, 2);
    await writeFile(authPath, auth);

    setInject([
      "CX",
      "oauth",
      authPath,
      "",
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
    expect(env.CODEX_AUTH_JSON_B64).toBe(Buffer.from(auth).toString("base64"));
    expect(env.CODEX_API_KEY).toBeUndefined();
  });
});

test("config writes Codex API key when api key auth is selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "CX",
      "apiKey",
      "sk-openai-test",
      "",
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
    expect(env.CODEX_API_KEY).toBe("sk-openai-test");
    expect(env.CODEX_AUTH_JSON_B64).toBeUndefined();
  });
});
