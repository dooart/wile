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

test("config writes Gemini OAuth creds when oauth auth is selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    const credsPath = join(dir, "oauth_creds.json");
    const creds = JSON.stringify({ access_token: "oauth-token" }, null, 2);
    await writeFile(credsPath, creds);

    setInject([
      "GC",
      "oauth",
      credsPath,
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
    expect(env.GEMINI_OAUTH_CREDS_B64).toBe(
      Buffer.from(creds).toString("base64")
    );
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });
});

test("config writes Gemini API key when api key auth is selected", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    setInject([
      "GC",
      "apiKey",
      "gemini-api-key",
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
    expect(env.GEMINI_API_KEY).toBe("gemini-api-key");
    expect(env.GEMINI_OAUTH_CREDS_B64).toBeUndefined();
  });
});
