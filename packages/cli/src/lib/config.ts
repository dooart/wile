import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type BerserkPaths = {
  berserkDir: string;
  secretsDir: string;
  envPath: string;
  envProjectPath: string;
  gitignorePath: string;
  prdPath: string;
};

export type BerserkConfig = {
  codingAgent: "CC";
  githubToken: string;
  githubRepoUrl: string;
  branchName: string;
  ccClaudeModel?: string;
  ccClaudeCodeOauthToken?: string;
  ccAnthropicApiKey?: string;
  envProject: Record<string, string>;
};

export const getBerserkPaths = (cwd: string = process.cwd()): BerserkPaths => {
  const berserkDir = join(cwd, ".berserk");
  const secretsDir = join(berserkDir, "secrets");
  return {
    berserkDir,
    secretsDir,
    envPath: join(secretsDir, ".env"),
    envProjectPath: join(secretsDir, ".env.project"),
    gitignorePath: join(berserkDir, ".gitignore"),
    prdPath: join(berserkDir, "prd.json")
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

export const readBerserkConfig = (options: { cwd?: string; validate?: boolean } = {}) => {
  const paths = getBerserkPaths(options.cwd);
  const validate = options.validate ?? true;

  if (validate) {
    ensureRequired(
      existsSync(paths.envPath),
      "Missing .berserk/secrets/.env. Run 'bunx berserk config' first."
    );
  }

  const env = parseEnvFile(paths.envPath);
  const envProject = parseEnvFile(paths.envProjectPath);

  if (validate) {
    ensureRequired(
      env.CODING_AGENT === "CC",
      "CODING_AGENT must be set to CC in .berserk/secrets/.env. Run 'bunx berserk config'."
    );
    ensureRequired(
      Boolean(env.GITHUB_TOKEN),
      "GITHUB_TOKEN is required in .berserk/secrets/.env. Run 'bunx berserk config'."
    );
    ensureRequired(
      Boolean(env.GITHUB_REPO_URL),
      "GITHUB_REPO_URL is required in .berserk/secrets/.env. Run 'bunx berserk config'."
    );
    ensureRequired(
      Boolean(env.BRANCH_NAME),
      "BRANCH_NAME is required in .berserk/secrets/.env. Run 'bunx berserk config'."
    );
    ensureRequired(
      Boolean(env.CC_CLAUDE_CODE_OAUTH_TOKEN || env.CC_ANTHROPIC_API_KEY),
      "Either CC_CLAUDE_CODE_OAUTH_TOKEN or CC_ANTHROPIC_API_KEY is required in .berserk/secrets/.env."
    );
  }

  return {
    paths,
    config: {
      codingAgent: (env.CODING_AGENT as "CC") ?? "CC",
      githubToken: env.GITHUB_TOKEN ?? "",
      githubRepoUrl: env.GITHUB_REPO_URL ?? "",
      branchName: env.BRANCH_NAME ?? "",
      ccClaudeModel: env.CC_CLAUDE_MODEL,
      ccClaudeCodeOauthToken: env.CC_CLAUDE_CODE_OAUTH_TOKEN,
      ccAnthropicApiKey: env.CC_ANTHROPIC_API_KEY,
      envProject
    }
  };
};
