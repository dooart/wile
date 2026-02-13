import { test, expect } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validatePrdLocation } from "../src/commands/run";
import { withTempDir } from "./helpers";

test("validatePrdLocation accepts .wile/prd.json", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    await mkdir(wileDir, { recursive: true });
    await writeFile(join(wileDir, "prd.json"), "{\n  \"stories\": []\n}\n");

    expect(() =>
      validatePrdLocation({
        prdPath: join(wileDir, "prd.json")
      })
    ).not.toThrow();
  });
});

test("validatePrdLocation rejects missing .wile/prd.json", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    await mkdir(wileDir, { recursive: true });

    expect(() =>
      validatePrdLocation({
        prdPath: join(wileDir, "prd.json")
      })
    ).toThrow("Missing .wile/prd.json. Run 'bunx wile config'.");
  });
});

test("validatePrdLocation rejects root-only prd.json", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    await mkdir(wileDir, { recursive: true });
    await writeFile(join(dir, "prd.json"), "{\n  \"stories\": []\n}\n");

    expect(() =>
      validatePrdLocation({
        prdPath: join(wileDir, "prd.json")
      })
    ).toThrow("Missing .wile/prd.json. Run 'bunx wile config'.");
  });
});
