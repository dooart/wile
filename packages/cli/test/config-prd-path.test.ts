import { test, expect } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runConfig } from "../src/commands/config";
import { withTempDir } from "./helpers";

const setInject = (values: unknown[]) => {
  process.env.WILE_PROMPTS_INJECT = JSON.stringify(values);
};

const clearInject = () => {
  delete process.env.WILE_PROMPTS_INJECT;
};

test("config creates .wile/prd.json and .wile/prd.json.example", async () => {
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

    expect(existsSync(join(dir, ".wile", "prd.json"))).toBe(true);
    expect(existsSync(join(dir, ".wile", "prd.json.example"))).toBe(true);
    expect(existsSync(join(dir, "prd.json"))).toBe(false);

    const contents = await readFile(join(dir, ".wile", "prd.json"), "utf8");
    expect(contents).toContain("\"stories\": []");
  });
});

test("config keeps existing .wile/prd.json", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    await mkdir(join(wileDir, "secrets"), { recursive: true });
    await writeFile(join(wileDir, "prd.json"), "{\n  \"stories\": []\n}\n");

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

    const contents = await readFile(join(wileDir, "prd.json"), "utf8");
    expect(contents).toContain("\"stories\": []");
  });
});
