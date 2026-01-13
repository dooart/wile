import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readWileConfig } from "../lib/config";
import {
  buildAgentImage,
  buildDockerArgs,
  getTimestamp,
  resolveAgentDir,
  runDockerWithLogging,
  validateGitignore
} from "./run";

export const runCompact = async (options: {
  repo?: string;
  maxIterations?: string;
  test?: boolean;
  debug?: boolean;
}) => {
  const cwd = process.cwd();

  let paths;
  let config;
  try {
    const result = readWileConfig({ cwd, validate: !options.test });
    paths = result.paths;
    config = result.config;
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  if (options.debug) {
    const initCwd = process.env.INIT_CWD ?? "(unset)";
    console.log("Debug:");
    console.log(`- cwd: ${cwd}`);
    console.log(`- INIT_CWD: ${initCwd}`);
    console.log(`- WILE_AGENT_DIR: ${process.env.WILE_AGENT_DIR ?? "(unset)"}`);
    console.log(`- codingAgent: ${config.codingAgent}`);
    console.log(`- repoSource: ${config.repoSource}`);
    console.log(`- githubRepoUrl: ${config.githubRepoUrl || "(empty)"}`);
    console.log(`- branchName: ${config.branchName || "(empty)"}`);
  }

  try {
    validateGitignore(paths.gitignorePath);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  if (!existsSync(paths.prdPath)) {
    console.error("Missing .wile/prd.json. Run 'bunx wile config'.");
    process.exit(1);
  }

  const progressPath = join(paths.wileDir, "progress.txt");
  if (!existsSync(progressPath)) {
    console.error("Missing .wile/progress.txt. Run 'bunx wile config'.");
    process.exit(1);
  }

  const agentDir = resolveAgentDir();
  const resolvedIterations = options.maxIterations || "1";
  buildAgentImage(agentDir);

  const dockerArgs = buildDockerArgs(
    { ...options, maxIterations: resolvedIterations },
    config,
    paths,
    cwd,
    ["WILE_MODE=compact"]
  );

  const logsDir = join(paths.wileDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, `compact-${getTimestamp()}.log`);
  writeFileSync(logPath, "", { flag: "w" });

  try {
    await runDockerWithLogging(dockerArgs, logPath);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
};
