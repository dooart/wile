import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";

export type WilePaths = {
  wileDir: string;
  secretsDir: string;
  envPath: string;
  envProjectPath: string;
  gitignorePath: string;
  prdPath: string;
};

export type WileConfig = {
  codingAgent: "CC" | "OC" | "CX";
  githubToken: string;
  githubRepoUrl: string;
  branchName: string;
  repoSource: "github" | "local";
  ccClaudeModel?: string;
  maxIterations?: string;
  ccClaudeCodeOauthToken?: string;
  ccAnthropicApiKey?: string;
  ocProvider?: "native" | "openrouter";
  ocOpenrouterApiKey?: string;
  ocModel?: string;
  cxApiKey?: string;
  cxModel?: string;
  envProject: Record<string, string>;
};

export const getWilePaths = (cwd: string = process.cwd()): WilePaths => {
  const wileDir = join(cwd, ".wile");
  const secretsDir = join(wileDir, "secrets");
  return {
    wileDir,
    secretsDir,
    envPath: join(secretsDir, ".env"),
    envProjectPath: join(wileDir, ".env.project"),
    gitignorePath: join(wileDir, ".gitignore"),
    prdPath: join(wileDir, "prd.json")
  };
};

const resolveEnvProjectPath = (cwd: string, configured?: string) => {
  const defaultPath = join(cwd, ".wile", ".env.project");
  const legacyPath = join(cwd, ".wile", "secrets", ".env.project");

  if (configured && configured.trim().length > 0) {
    return isAbsolute(configured) ? configured : resolve(cwd, configured);
  }

  if (existsSync(defaultPath)) {
    return defaultPath;
  }
  if (existsSync(legacyPath)) {
    return legacyPath;
  }
  return defaultPath;
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
  const envProjectPath = resolveEnvProjectPath(options.cwd ?? process.cwd(), env.WILE_ENV_PROJECT_PATH);
  const envProject = parseEnvFile(envProjectPath);

  const repoSource = (env.WILE_REPO_SOURCE as "github" | "local") || "github";

  if (validate) {
    ensureRequired(
      env.CODING_AGENT === "CC" || env.CODING_AGENT === "OC" || env.CODING_AGENT === "CX",
      "CODING_AGENT must be set to CC, OC, or CX in .wile/secrets/.env. Run 'bunx wile config'."
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
    if (env.CODING_AGENT === "CC") {
      ensureRequired(
        Boolean(env.CC_CLAUDE_CODE_OAUTH_TOKEN || env.CC_ANTHROPIC_API_KEY),
        "Either CC_CLAUDE_CODE_OAUTH_TOKEN or CC_ANTHROPIC_API_KEY is required in .wile/secrets/.env."
      );
    }
    if (env.CODING_AGENT === "OC") {
      const ocProvider = env.OC_PROVIDER || "native";
      if (ocProvider === "openrouter") {
        ensureRequired(
          Boolean(env.OC_OPENROUTER_API_KEY),
          "OC_OPENROUTER_API_KEY is required in .wile/secrets/.env for OpenCode with OpenRouter provider."
        );
      }
      ensureRequired(
        Boolean(env.OC_MODEL),
        "OC_MODEL is required in .wile/secrets/.env for OpenCode."
      );
    }
    if (env.CODING_AGENT === "CX") {
      ensureRequired(
        Boolean(env.CX_API_KEY),
        "CX_API_KEY is required in .wile/secrets/.env for Codex."
      );
      ensureRequired(
        Boolean(env.CX_MODEL),
        "CX_MODEL is required in .wile/secrets/.env for Codex."
      );
    }
  }

  return {
    paths: {
      ...paths,
      envProjectPath
    },
    config: {
      codingAgent: (env.CODING_AGENT as "CC" | "OC" | "CX") ?? "CC",
      githubToken: env.GITHUB_TOKEN ?? "",
      githubRepoUrl: env.GITHUB_REPO_URL ?? "",
      branchName: env.BRANCH_NAME ?? "",
      repoSource,
      ccClaudeModel: env.CC_CLAUDE_MODEL,
      maxIterations: env.WILE_MAX_ITERATIONS,
      ccClaudeCodeOauthToken: env.CC_CLAUDE_CODE_OAUTH_TOKEN,
      ccAnthropicApiKey: env.CC_ANTHROPIC_API_KEY,
      ocProvider: (env.OC_PROVIDER as "native" | "openrouter") ?? "native",
      ocOpenrouterApiKey: env.OC_OPENROUTER_API_KEY,
      ocModel: env.OC_MODEL,
      cxApiKey: env.CX_API_KEY,
      cxModel: env.CX_MODEL,
      envProject
    }
  };
};
