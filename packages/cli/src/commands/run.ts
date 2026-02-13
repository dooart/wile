import { existsSync, readFileSync, mkdirSync, createWriteStream, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readWileConfig } from "../lib/config";
import { readAndValidatePrd } from "../lib/prd";

const findAgentDir = (startDir: string) => {
  let current = startDir;
  while (true) {
    const candidate = join(current, "packages", "agent");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

export const validateGitignore = (path: string) => {
  if (!existsSync(path)) {
    throw new Error("Missing .wile/.gitignore. Run 'bunx wile config'.");
  }
  const contents = readFileSync(path, "utf8");
  const missing: string[] = [];
  if (!contents.includes("secrets/")) missing.push("secrets/");
  if (!contents.includes("screenshots/")) missing.push("screenshots/");
  if (!contents.includes("logs/")) missing.push("logs/");
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in .wile/.gitignore. Run 'bunx wile config'.`
    );
  }
};

export const validatePrdLocation = (paths: { prdPath: string }) => {
  if (!existsSync(paths.prdPath)) {
    throw new Error("Missing .wile/prd.json. Run 'bunx wile config'.");
  }
};

export const buildAgentImage = (agentDir: string) => {
  const result = spawnSync("docker", ["build", "-t", "wile-agent:local", agentDir], {
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("Docker build failed.");
  }
};

export const resolveAgentDir = () => {
  const override = process.env.WILE_AGENT_DIR;
  if (override && existsSync(override)) {
    return override;
  }
  const initCwd = process.env.INIT_CWD;
  if (initCwd) {
    const found = findAgentDir(initCwd);
    if (found) {
      return found;
    }
  }
  const foundFromCwd = findAgentDir(process.cwd());
  if (foundFromCwd) {
    return foundFromCwd;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const bundledAgentDir = join(here, "agent");
  if (existsSync(bundledAgentDir)) {
    return bundledAgentDir;
  }
  const cliRoot = resolve(here, "..", "..", "..");
  const agentDir = join(cliRoot, "agent");
  if (!existsSync(agentDir)) {
    throw new Error("Unable to locate packages/agent. Run from the monorepo.");
  }
  return agentDir;
};

export const getTimestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

export const runDockerWithLogging = (args: string[], logPath: string) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    const logStream = createWriteStream(logPath, { flags: "a" });
    const child = spawn("docker", args, {
      stdio: ["inherit", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });

    child.on("error", (error) => {
      logStream.end();
      rejectPromise(error);
    });

    child.on("close", (code) => {
      logStream.end();
      if (code !== 0) {
        rejectPromise(new Error("Docker run failed."));
        return;
      }
      resolvePromise();
    });
  });

export const buildDockerArgs = (
  options: {
    repo?: string;
    maxIterations: string;
    test?: boolean;
  },
  config: {
    githubRepoUrl: string;
    repoSource: "github" | "local";
  },
  paths: {
    envPath: string;
    envProjectPath: string;
    wileDir: string;
  },
  cwd: string,
  extraEnv: string[] = []
) => {
  const dockerArgs = ["run", "--rm"];

  if (options.test) {
    dockerArgs.push(
      "-e",
      "WILE_TEST=true",
      "-e",
      "WILE_TEST_REPO_PATH=/home/wile/workspace/repo",
      "-v",
      `${cwd}:/home/wile/workspace/repo`
    );
  }

  if (options.maxIterations) {
    dockerArgs.push("-e", `MAX_ITERATIONS=${options.maxIterations}`);
  }

  const repoSource =
    options.test || options.repo ? "github" : config.repoSource ?? "github";

  if (repoSource === "local") {
    dockerArgs.push(
      "-e",
      "WILE_REPO_SOURCE=local",
      "-e",
      "WILE_LOCAL_REPO_PATH=/home/wile/workspace/repo",
      "-v",
      `${cwd}:/home/wile/workspace/repo`
    );
  } else {
    const repoValue = options.repo ?? config.githubRepoUrl;
    if (repoValue) {
      dockerArgs.push("-e", `GITHUB_REPO_URL=${repoValue}`);
    }
  }

  const envFiles = [paths.envPath, paths.envProjectPath].filter((path) => existsSync(path));
  for (const envFile of envFiles) {
    dockerArgs.push("--env-file", envFile);
  }

  for (const envEntry of extraEnv) {
    dockerArgs.push("-e", envEntry);
  }

  const additionalInstructionsPath = join(paths.wileDir, "additional-instructions.md");
  if (existsSync(additionalInstructionsPath)) {
    dockerArgs.push("-e", `WILE_ADDITIONAL_INSTRUCTIONS=${additionalInstructionsPath}`);
    dockerArgs.push("-v", `${additionalInstructionsPath}:${additionalInstructionsPath}`);
  }

  dockerArgs.push("wile-agent:local");
  return dockerArgs;
};

export const runWile = async (options: {
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

  const repoSource =
    options.test || options.repo ? "github" : config.repoSource ?? "github";
  const shouldValidateLocalPrd = options.test || repoSource === "local";
  if (shouldValidateLocalPrd) {
    try {
      validatePrdLocation(paths);
      const validation = readAndValidatePrd(paths.prdPath);
      if (validation.allDone) {
        console.log("No pending stories in .wile/prd.json. Add a pending story to run Wile.");
        return;
      }
    } catch (error) {
      console.error((error as Error).message);
      process.exit(1);
    }
  }

  const agentDir = resolveAgentDir();
  const resolvedIterations = options.maxIterations || config.maxIterations || "25";
  buildAgentImage(agentDir);

  const dockerArgs = buildDockerArgs(
    { ...options, maxIterations: resolvedIterations },
    config,
    paths,
    cwd
  );

  const logsDir = join(paths.wileDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, `run-${getTimestamp()}.log`);
  writeFileSync(logPath, "", { flag: "w" });

  if (options.test) {
    const message = "TEST MODE: running mocked agent inside Docker.\n";
    process.stdout.write(message);
    writeFileSync(logPath, message, { flag: "a" });
  }
  if (options.debug) {
    console.log(`- logsDir: ${logsDir}`);
    console.log(`- logPath: ${logPath}`);
  }

  await runDockerWithLogging(dockerArgs, logPath);

  const finishMessage = "Wile run complete. Monitor progress with git log in your repo.\n";
  process.stdout.write(finishMessage);
  writeFileSync(logPath, finishMessage, { flag: "a" });
};
