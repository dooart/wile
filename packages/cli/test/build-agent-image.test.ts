import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAgentImage } from "../src/commands/run";
import { withTempDir } from "./helpers";

test("buildAgentImage rejects custom Dockerfile that does not extend Wile base image", async () => {
  await withTempDir(async (dir) => {
    const agentDir = join(dir, "agent");
    await mkdir(agentDir, { recursive: true });
    const dockerfilePath = join(dir, "Dockerfile");
    await writeFile(dockerfilePath, "FROM ubuntu:22.04\n");

    expect(() =>
      buildAgentImage(agentDir, {
        projectDir: dir,
        customDockerfilePath: dockerfilePath
      })
    ).toThrow("Custom Dockerfile must extend wile-agent:base.");
  });
});
