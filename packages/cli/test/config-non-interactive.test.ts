import { test, expect } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runConfig } from "../src/commands/config";
import { readEnvFile, withTempDir } from "./helpers";

const captureOutput = async (fn: () => Promise<void>) => {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  const stdoutWrite: typeof process.stdout.write = ((...args: Parameters<typeof process.stdout.write>) => {
    stdoutChunks.push(String(args[0]));
    return true;
  }) as typeof process.stdout.write;
  const stderrWrite: typeof process.stderr.write = ((...args: Parameters<typeof process.stderr.write>) => {
    stderrChunks.push(String(args[0]));
    return true;
  }) as typeof process.stderr.write;

  process.stdout.write = stdoutWrite;
  process.stderr.write = stderrWrite;

  try {
    await fn();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return { stdout: stdoutChunks.join(""), stderr: stderrChunks.join("") };
};

test("config non-interactive applies valid agent config", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, ".wile", "secrets"), { recursive: true });
    const payload = JSON.stringify({
      codingAgent: "OC",
      repoSource: "local",
      ocModel: "opencode/kimi-k2.5-free",
      branchName: "main",
      envProjectPath: ".wile/.env.project",
      maxIterations: 12,
    });

    await runConfig({ nonInteractive: payload });

    const env = await readEnvFile(join(dir, ".wile", "secrets", ".env"));
    expect(env.CODING_AGENT).toBe("OC");
    expect(env.WILE_REPO_SOURCE).toBe("local");
    expect(env.OC_MODEL).toBe("opencode/kimi-k2.5-free");
    expect(env.WILE_MAX_ITERATIONS).toBe("12");
  });
});

test("config non-interactive prints docs when flag has no value", async () => {
  const output = await captureOutput(async () => {
    await runConfig({ nonInteractive: true });
  });

  expect(output.stdout).toContain("Wile non-interactive config");
  expect(output.stdout).toContain("WILE_PROMPTS_INJECT");
});

test("config non-interactive prints docs and error when payload is invalid", async () => {
  await withTempDir(async (dir) => {
    let ok = true;
    const output = await captureOutput(async () => {
      ok = await runConfig({
        nonInteractive: JSON.stringify({
          codingAgent: "GC",
          repoSource: "local",
          gcAuthMethod: "oauth",
        }),
      });
    });

    expect(output.stdout).toContain("Wile non-interactive config");
    expect(ok).toBe(false);
    expect(existsSync(join(dir, ".wile", "secrets", ".env"))).toBe(false);
  });
});
