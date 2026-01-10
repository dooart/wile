import { test, expect } from "bun:test";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runConfig } from "../src/commands/config";
import { readEnvFile, withTempDir } from "./helpers";

const setInject = (values: unknown[]) => {
  process.env.WILE_PROMPTS_INJECT = JSON.stringify(values);
};

const clearInject = () => {
  delete process.env.WILE_PROMPTS_INJECT;
};

test("config keeps existing values when inputs are empty", async () => {
  await withTempDir(async (dir) => {
    const secretsDir = join(dir, ".wile", "secrets");
    await mkdir(secretsDir, { recursive: true });
    await writeFile(
      join(secretsDir, ".env"),
      [
        "CODING_AGENT=CC",
        "WILE_REPO_SOURCE=github",
        "GITHUB_TOKEN=existing-token",
        "GITHUB_REPO_URL=https://github.com/acme/existing",
        "BRANCH_NAME=existing-branch",
        "CC_CLAUDE_MODEL=sonnet",
        "WILE_MAX_ITERATIONS=17",
        "CC_CLAUDE_CODE_OAUTH_TOKEN=existing-oauth"
      ].join("\n") + "\n"
    );

    setInject([
      "CC",
      "oauth",
      "",
      "sonnet",
      "github",
      "",
      "",
      "",
      "",
      ""
    ]);

    try {
      await runConfig();
    } finally {
      clearInject();
    }

    const env = await readEnvFile(join(secretsDir, ".env"));
    expect(env.GITHUB_TOKEN).toBe("existing-token");
    expect(env.GITHUB_REPO_URL).toBe("https://github.com/acme/existing");
    expect(env.BRANCH_NAME).toBe("existing-branch");
    expect(env.WILE_MAX_ITERATIONS).toBe("17");
    expect(env.CC_CLAUDE_CODE_OAUTH_TOKEN).toBe("existing-oauth");
    await access(join(dir, ".wile", ".env.project"));
  });
});

test("config preserves existing preflight instructions", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    const secretsDir = join(wileDir, "secrets");
    await mkdir(secretsDir, { recursive: true });
    await writeFile(
      join(wileDir, "preflight.md"),
      "<!--\nCustom preflight\n-->\n- Keep this line\n"
    );

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

    const contents = await readFile(join(wileDir, "preflight.md"), "utf8");
    expect(contents).toBe("<!--\nCustom preflight\n-->\n- Keep this line\n");
  });
});

test("config preserves existing additional instructions", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    const secretsDir = join(wileDir, "secrets");
    await mkdir(secretsDir, { recursive: true });
    await writeFile(
      join(wileDir, "additional-instructions.md"),
      "<!--\nCustom additional\n-->\n- Keep this line\n"
    );

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

    const contents = await readFile(
      join(wileDir, "additional-instructions.md"),
      "utf8"
    );
    expect(contents).toBe("<!--\nCustom additional\n-->\n- Keep this line\n");
  });
});
