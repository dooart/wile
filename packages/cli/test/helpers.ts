import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const withTempDir = async <T>(fn: (dir: string) => Promise<T>) => {
  const dir = await mkdtemp(join(tmpdir(), "wile-cli-test-"));
  const prevCwd = process.cwd();
  process.chdir(dir);
  try {
    return await fn(dir);
  } finally {
    process.chdir(prevCwd);
    await rm(dir, { recursive: true, force: true });
  }
};

export const readEnvFile = async (path: string) => {
  const contents = await readFile(path, "utf8");
  const env: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 1);
    env[key] = value;
  }
  return env;
};
