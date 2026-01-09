import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type WilePaths = {
  wileDir: string;
  secretsDir: string;
  envPath: string;
  envProjectPath: string;
  gitignorePath: string;
  prdPath: string;
};

export type WileConfig = {
  codingAgent: "CC";
  githubToken: string;
  githubRepoUrl: string;
  branchName: string;
  repoSource: "github" | "local";
  ccClaudeModel?: string;
  maxIterations?: string;
  ccClaudeCodeOauthToken?: string;
  ccAnthropicApiKey?: string;
  envProject: Record<string, string>;
};

export const getWilePaths = (cwd: string = process.cwd()): WilePaths => {
  const wileDir = join(cwd, ".wile");
  const secretsDir = join(wileDir, "secrets");
  return {
    wileDir,
    secretsDir,
    envPath: join(secretsDir, ".env"),
    envProjectPath: join(secretsDir, ".env.project"),
    gitignorePath: join(wileDir, ".gitignore"),
    prdPath: join(wileDir, "prd.json")
  };
};

const parseEnvFile = (path: string) => {
  if (!existsSync(path)) {
    return {} as Record<string, string>;
  }
  const contents = readFileSync(path, "utf8");
  return dotenv.parse(contents);
};

const ensureRequired = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

export const readWileConfig = (options: { cwd?: string; validate?: boolean } = {}) => {
  const paths = getWilePaths(options.cwd);
  const validate = options.validate ?? true;

  if (validate) {
    ensureRequired(
      existsSync(paths.envPath),
      "Missing .wile/secrets/.env. Run 'bunx wile config' first."
    );
  }

  const env = parseEnvFile(paths.envPath);
  const envProject = parseEnvFile(paths.envProjectPath);

  const repoSource = (env.WILE_REPO_SOURCE as "github" | "local") || "github";

  if (validate) {
    ensureRequired(
      env.CODING_AGENT === "CC",
      "CODING_AGENT must be set to CC in .wile/secrets/.env. Run 'bunx wile config'."
    );
    if (repoSource === "github") {
      ensureRequired(
        Boolean(env.GITHUB_TOKEN),
        "GITHUB_TOKEN is required in .wile/secrets/.env. Run 'bunx wile config'."
      );
      ensureRequired(
        Boolean(env.GITHUB_REPO_URL),
        "GITHUB_REPO_URL is required in .wile/secrets/.env. Run 'bunx wile config'."
      );
      ensureRequired(
        Boolean(env.BRANCH_NAME),
        "BRANCH_NAME is required in .wile/secrets/.env. Run 'bunx wile config'."
      );
    }
    ensureRequired(
      Boolean(env.CC_CLAUDE_CODE_OAUTH_TOKEN || env.CC_ANTHROPIC_API_KEY),
      "Either CC_CLAUDE_CODE_OAUTH_TOKEN or CC_ANTHROPIC_API_KEY is required in .wile/secrets/.env."
    );
  }

  return {
    paths,
    config: {
      codingAgent: (env.CODING_AGENT as "CC") ?? "CC",
      githubToken: env.GITHUB_TOKEN ?? "",
      githubRepoUrl: env.GITHUB_REPO_URL ?? "",
      branchName: env.BRANCH_NAME ?? "",
      repoSource,
      ccClaudeModel: env.CC_CLAUDE_MODEL,
      maxIterations: env.WILE_MAX_ITERATIONS,
      ccClaudeCodeOauthToken: env.CC_CLAUDE_CODE_OAUTH_TOKEN,
      ccAnthropicApiKey: env.CC_ANTHROPIC_API_KEY,
      envProject
    }
  };
};
