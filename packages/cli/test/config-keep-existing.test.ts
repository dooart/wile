import { test, expect } from "bun:test";
import { mkdir, writeFile, access } from "node:fs/promises";
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
    expect(env.CC_CLAUDE_CODE_OAUTH_TOKEN).toBe("existing-oauth");
    await access(join(secretsDir, ".env.project"));
  });
});
