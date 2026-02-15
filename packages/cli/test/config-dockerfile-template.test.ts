import { test, expect } from "bun:test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runConfig } from "../src/commands/config";
import { withTempDir } from "./helpers";

const setInject = (values: unknown[]) => {
  process.env.WILE_PROMPTS_INJECT = JSON.stringify(values);
};

const clearInject = () => {
  delete process.env.WILE_PROMPTS_INJECT;
};

test("config creates .wile/Dockerfile template when missing", async () => {
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

    const contents = await readFile(join(dir, ".wile", "Dockerfile"), "utf8");
    expect(contents).toContain("ARG WILE_BASE_IMAGE=wile-agent:base");
    expect(contents).toContain("FROM ${WILE_BASE_IMAGE}");
  });
});
