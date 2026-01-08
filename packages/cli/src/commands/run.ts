import { existsSync, readFileSync, mkdirSync, createWriteStream, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readBerserkConfig } from "../lib/config";

const readJson = (path: string) => {
  try {
    const contents = readFileSync(path, "utf8");
    return JSON.parse(contents) as { userStories?: { passes?: boolean; priority?: number }[] };
  } catch {
    throw new Error(`Failed to read ${path}. Ensure it is valid JSON.`);
  }
};

const validateGitignore = (path: string) => {
  if (!existsSync(path)) {
    throw new Error("Missing .berserk/.gitignore. Run 'bunx berserk config'.");
  }
  const contents = readFileSync(path, "utf8");
  const missing: string[] = [];
  if (!contents.includes("secrets/")) missing.push("secrets/");
  if (!contents.includes("screenshots/")) missing.push("screenshots/");
  if (!contents.includes("logs/")) missing.push("logs/");
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in .berserk/.gitignore. Run 'bunx berserk config'.`
    );
  }
};

const hasPendingStories = (prd: { userStories?: { passes?: boolean; priority?: number }[] }) => {
  if (!Array.isArray(prd.userStories)) {
    return false;
  }
  return prd.userStories.some((story) => story.passes === false);
};

const buildAgentImage = (agentDir: string) => {
  const result = spawnSync("docker", ["build", "-t", "berserk-agent:local", agentDir], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("Docker build failed.");
  }
};

const resolveAgentDir = () => {
  const override = process.env.BERSERK_AGENT_DIR;
  if (override && existsSync(override)) {
    return override;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const cliRoot = resolve(here, "..", "..", "..");
  const agentDir = join(cliRoot, "..", "agent");
  if (!existsSync(agentDir)) {
    throw new Error("Unable to locate packages/agent. Run from the monorepo.");
  }
  return agentDir;
};

const getTimestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const runDockerWithLogging = (args: string[], logPath: string) => {
  const logStream = createWriteStream(logPath, { flags: "a" });
  const result = spawnSync("docker", args, {
    stdio: ["inherit", "pipe", "pipe"]
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
    logStream.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
    logStream.write(result.stderr);
  }

  logStream.end();

  if (result.status !== 0) {
    throw new Error("Docker run failed.");
  }
};

export const runBerserk = (options: {
  branch: string;
  repo?: string;
  maxIterations: string;
  test?: boolean;
}) => {
  const cwd = process.cwd();

  let paths;
  let config;
  try {
    const result = readBerserkConfig({ cwd, validate: !options.test });
    paths = result.paths;
    config = result.config;
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  try {
    validateGitignore(paths.gitignorePath);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }

  if (!existsSync(paths.prdPath)) {
    console.error("Missing .berserk/prd.json. Run 'bunx berserk config'.");
    process.exit(1);
  }

  const prd = readJson(paths.prdPath);
  if (!hasPendingStories(prd)) {
    console.log("No pending stories in .berserk/prd.json. Add a story to run Berserk.");
    return;
  }

  const agentDir = resolveAgentDir();
  buildAgentImage(agentDir);

  const dockerArgs = ["run", "--rm"];

  if (options.test) {
    dockerArgs.push(
      "-e",
      "BERSERK_TEST=true",
      "-e",
      "BERSERK_TEST_REPO_PATH=/home/berserk/workspace/repo",
      "-v",
      `${cwd}:/home/berserk/workspace/repo`
    );
  }

  if (options.maxIterations) {
    dockerArgs.push("-e", `MAX_ITERATIONS=${options.maxIterations}`);
  }

  const repoValue = options.repo ?? config.githubRepoUrl;
  if (repoValue) {
    dockerArgs.push("-e", `GITHUB_REPO_URL=${repoValue}`);
  }

  if (options.branch) {
    dockerArgs.push("-e", `BRANCH_NAME=${options.branch}`);
  }

  const envFiles = [paths.envPath, paths.envProjectPath].filter((path) => existsSync(path));
  for (const envFile of envFiles) {
    dockerArgs.push("--env-file", envFile);
  }

  dockerArgs.push("berserk-agent:local");

  const logsDir = join(paths.berserkDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, `run-${getTimestamp()}.log`);

  if (options.test) {
    const message = "TEST MODE: running mocked agent inside Docker.\n";
    process.stdout.write(message);
    writeFileSync(logPath, message, { flag: "a" });
  }

  runDockerWithLogging(dockerArgs, logPath);

  const finishMessage = "Berserk run complete. Monitor progress with git log in your repo.\n";
  process.stdout.write(finishMessage);
  writeFileSync(logPath, finishMessage, { flag: "a" });
};
