import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readWileConfig } from "../src/lib/config";
import { withTempDir } from "./helpers";

test("readWileConfig auto-detects .wile/Dockerfile", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    await mkdir(join(wileDir, "secrets"), { recursive: true });
    await writeFile(join(wileDir, "secrets", ".env"), "CODING_AGENT=CC\n");
    await writeFile(join(wileDir, "Dockerfile"), "FROM wile-agent:base\n");

    const { config } = readWileConfig({ cwd: dir, validate: false });
    expect(config.agentDockerfile).toBe(join(wileDir, "Dockerfile"));
  });
});

test("readWileConfig leaves custom dockerfile unset when .wile/Dockerfile is missing", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    await mkdir(join(wileDir, "secrets"), { recursive: true });
    await writeFile(join(wileDir, "secrets", ".env"), "CODING_AGENT=CC\n");

    const { config } = readWileConfig({ cwd: dir, validate: false });
    expect(config.agentDockerfile).toBeUndefined();
  });
});

test("readWileConfig ignores legacy WILE_AGENT_DOCKERFILE key", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    await mkdir(join(wileDir, "secrets"), { recursive: true });
    await writeFile(
      join(wileDir, "secrets", ".env"),
      ["CODING_AGENT=CC", "WILE_AGENT_DOCKERFILE=.wile/custom.Dockerfile"].join("\n") + "\n"
    );

    const { config } = readWileConfig({ cwd: dir, validate: false });
    expect(config.agentDockerfile).toBeUndefined();
  });
});
