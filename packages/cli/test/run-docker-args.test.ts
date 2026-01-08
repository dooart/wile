import { test, expect } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildDockerArgs } from "../src/commands/run";
import { withTempDir } from "./helpers";

test("run command forwards env files into docker args", async () => {
  await withTempDir(async (dir) => {
    const wileDir = join(dir, ".wile");
    const secretsDir = join(wileDir, "secrets");
    await mkdir(secretsDir, { recursive: true });
    await writeFile(join(secretsDir, ".env"), "CODING_AGENT=CC\n");
    await writeFile(join(secretsDir, ".env.project"), "TEST_FORWARD=ok\n");

    const args = buildDockerArgs(
      { maxIterations: "25" },
      { githubRepoUrl: "https://github.com/acme/test", repoSource: "github" },
      { envPath: join(secretsDir, ".env"), envProjectPath: join(secretsDir, ".env.project") },
      dir
    );

    const joined = args.join(" ");
    expect(joined).toContain(`--env-file ${join(secretsDir, ".env")}`);
    expect(joined).toContain(`--env-file ${join(secretsDir, ".env.project")}`);
  });
});
