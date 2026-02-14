import prompts from "prompts";
import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { homedir } from "node:os";
import {
  splitEnv,
  toEnvString,
  type EnvFileKey,
  type KnownEnv,
} from "../lib/env-schema";

const prdExample = {
  stories: [
    {
      id: 1,
      title: "Initialize project with Vite and React",
      description: "Set up a minimal React + Vite + TypeScript project.",
      acceptanceCriteria: [
        "package.json exists with vite, react, react-dom dependencies",
        "vite.config.ts configured for React",
        "src/main.tsx renders App component",
        "src/App.tsx exists with basic structure",
        "npm run dev starts dev server on port 5173",
        "npm run build produces dist/ folder",
      ],
      dependsOn: [],
      status: "pending",
    },
    {
      id: 2,
      title: "Create 3x3 game board component",
      description: "Render a centered 3x3 visual board with clickable cells.",
      acceptanceCriteria: [
        "src/components/Board.tsx exists",
        "Renders 3x3 grid of clickable squares",
        "Grid uses CSS Grid layout",
        "Each square is 100x100 pixels",
        "Board is centered on page",
        "Squares have visible borders",
      ],
      dependsOn: [1],
      status: "pending",
    },
    {
      id: 3,
      title: "Implement alternating X and O turns",
      description: "Track turns and prevent overwriting existing moves.",
      acceptanceCriteria: [
        "First click places X",
        "Second click places O",
        "Pattern continues alternating",
        "X displayed in blue color",
        "O displayed in red color",
        "Cannot click already-filled square",
      ],
      dependsOn: [2],
      status: "pending",
    },
    {
      id: 4,
      title: "Detect win condition",
      description: "Determine winner across rows, columns, and diagonals.",
      acceptanceCriteria: [
        "Detects horizontal wins (3 rows)",
        "Detects vertical wins (3 columns)",
        "Detects diagonal wins (2 diagonals)",
        "Shows 'X Wins!' or 'O Wins!' message when won",
        "Winning message appears above the board",
        "No more moves allowed after win",
      ],
      dependsOn: [3],
      status: "pending",
    },
    {
      id: 5,
      title: "Detect draw and add reset button",
      description: "Handle full-board draw and allow restarting the game.",
      acceptanceCriteria: [
        "Shows 'Draw!' when all 9 squares filled with no winner",
        "Reset button appears below the board",
        "Clicking reset clears all squares",
        "Reset sets turn back to X",
        "Reset clears any win/draw message",
      ],
      dependsOn: [4],
      status: "pending",
    },
    {
      id: 6,
      title: "Add current turn indicator",
      description: "Show whose turn it is while the game is still active.",
      acceptanceCriteria: [
        "Shows 'Current turn: X' or 'Current turn: O' above board",
        "Updates after each move",
        "Hidden when game is won or drawn",
        "X indicator in blue, O indicator in red",
      ],
      dependsOn: [3],
      status: "pending",
    },
  ],
};

const tips = {
  oauth:
    "Tip: run 'claude setup-token' on your machine to generate an OAuth token (uses Pro/Max subscription).",
  apiKey: "Tip: create an Anthropic API key in the console (uses API credits).",
  github:
    "Tip: use a GitHub Personal Access Token (fine-grained recommended). Create at https://github.com/settings/tokens?type=beta with Contents (read/write) and Metadata (read).",
  geminiOauth:
    "Tip: run 'gemini' locally and choose Login with Google to create ~/.gemini/oauth_creds.json.",
  geminiApiKey:
    "Tip: create a Gemini API key at https://aistudio.google.com/app/apikey (pay per token).",
  codexOauth:
    "Tip: run 'codex login' (or 'codex login --device-auth') locally to create ~/.codex/auth.json.",
  codexApiKey:
    "Tip: create an OpenAI API key at https://platform.openai.com/api-keys (pay per token).",
};

const nativeOcModels = [
  { title: "Kimi K2.5 Free (recommended)", value: "opencode/kimi-k2.5-free" },
  { title: "MiniMax 2.5", value: "opencode/minimax-m2.5-free" },
  { title: "Big Pickle", value: "opencode/big-pickle" },
];

type CodingAgent = "CC" | "OC" | "GC" | "CX";
type RepoSource = "github" | "local";
type AgentAuthMethod = "oauth" | "apiKey";

type NonInteractiveConfig = {
  codingAgent: CodingAgent;
  repoSource: RepoSource;
  branchName?: string;
  envProjectPath?: string;
  maxIterations?: number;
  githubToken?: string;
  repoUrl?: string;
  ccAuthMethod?: AgentAuthMethod;
  ccAuthValue?: string;
  ccModel?: "sonnet" | "opus" | "haiku";
  ocModel?: string;
  gcAuthMethod?: AgentAuthMethod;
  gcOauthPath?: string;
  gcApiKey?: string;
  gcModel?: string;
  cxAuthMethod?: AgentAuthMethod;
  cxAuthJsonPath?: string;
  cxApiKey?: string;
  cxModel?: string;
};

type RunConfigOptions = {
  nonInteractive?: string | boolean;
};

const nonInteractiveKeys = new Set<keyof NonInteractiveConfig>([
  "codingAgent",
  "repoSource",
  "branchName",
  "envProjectPath",
  "maxIterations",
  "githubToken",
  "repoUrl",
  "ccAuthMethod",
  "ccAuthValue",
  "ccModel",
  "ocModel",
  "gcAuthMethod",
  "gcOauthPath",
  "gcApiKey",
  "gcModel",
  "cxAuthMethod",
  "cxAuthJsonPath",
  "cxApiKey",
  "cxModel",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const renderNonInteractiveConfigHelp = () => {
  const lines: string[] = [];
  lines.push("# Wile non-interactive config");
  lines.push("");
  lines.push("Use one flag for both docs and config application:");
  lines.push("- `bunx wile config --non-interactive` prints this help.");
  lines.push(
    "- `bunx wile config --non-interactive '<json>'` validates and applies config.",
  );
  lines.push(
    "- Direct edits to `.wile/secrets/.env` are discouraged; prefer this command so validation runs before writing.",
  );
  lines.push("");
  lines.push("The JSON payload is ideal to pass via `WILE_PROMPTS_INJECT`:");
  lines.push("```bash");
  lines.push(
    "export WILE_PROMPTS_INJECT='{\"codingAgent\":\"OC\",\"repoSource\":\"local\",\"ocModel\":\"opencode/kimi-k2.5-free\",\"branchName\":\"main\",\"envProjectPath\":\".wile/.env.project\",\"maxIterations\":25}'",
  );
  lines.push("bunx wile config --non-interactive \"$WILE_PROMPTS_INJECT\"");
  lines.push("```");
  lines.push("");
  lines.push("Required fields:");
  lines.push("- Always: `codingAgent`, `repoSource`.");
  lines.push("- If `repoSource=github`: `githubToken`, `repoUrl`.");
  lines.push("- If `codingAgent=CC`: `ccAuthMethod`, `ccAuthValue`.");
  lines.push("- If `codingAgent=OC`: `ocModel`.");
  lines.push("- If `codingAgent=GC` and `gcAuthMethod=oauth`: `gcOauthPath`.");
  lines.push("- If `codingAgent=GC` and `gcAuthMethod=apiKey`: `gcApiKey`.");
  lines.push("- If `codingAgent=CX` and `cxAuthMethod=oauth`: `cxAuthJsonPath`.");
  lines.push("- If `codingAgent=CX` and `cxAuthMethod=apiKey`: `cxApiKey`.");
  lines.push("");
  lines.push("Optional fields:");
  lines.push("- `branchName` (default `main`)");
  lines.push("- `envProjectPath` (default `.wile/.env.project`)");
  lines.push("- `maxIterations` (default `25`)");
  lines.push("- `ccModel` (`sonnet` | `opus` | `haiku`, default `opus`)");
  lines.push("- `gcModel` (default `gemini-3-pro-preview`)");
  lines.push("- `cxModel` (default `gpt-5.3-codex`)");
  lines.push("");
  lines.push("Example (GitHub + Claude OAuth):");
  lines.push("```json");
  lines.push("{");
  lines.push('  "codingAgent": "CC",');
  lines.push('  "repoSource": "github",');
  lines.push('  "githubToken": "ghp_xxx",');
  lines.push('  "repoUrl": "https://github.com/owner/repo",');
  lines.push('  "branchName": "main",');
  lines.push('  "ccAuthMethod": "oauth",');
  lines.push('  "ccAuthValue": "claude_oauth_token",');
  lines.push('  "ccModel": "opus",');
  lines.push('  "maxIterations": 25');
  lines.push("}");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
};

const parseNonInteractiveConfig = (
  raw: string,
): { config?: NonInteractiveConfig; errors: string[] } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { errors: ["config is not valid JSON"] };
  }

  if (!isRecord(parsed)) {
    return { errors: ["config must be a JSON object"] };
  }

  const errors: string[] = [];
  for (const key of Object.keys(parsed)) {
    if (!nonInteractiveKeys.has(key as keyof NonInteractiveConfig)) {
      errors.push(`unknown key '${key}'`);
    }
  }

  const codingAgentRaw = parsed.codingAgent;
  const codingAgent =
    codingAgentRaw === "CC" ||
    codingAgentRaw === "OC" ||
    codingAgentRaw === "GC" ||
    codingAgentRaw === "CX"
      ? codingAgentRaw
      : undefined;
  if (!codingAgent) {
    errors.push("codingAgent must be one of: CC, OC, GC, CX");
  }

  const repoSourceRaw = parsed.repoSource;
  const repoSource =
    repoSourceRaw === "github" || repoSourceRaw === "local"
      ? repoSourceRaw
      : undefined;
  if (!repoSource) {
    errors.push("repoSource must be one of: github, local");
  }

  const branchName = asNonEmptyString(parsed.branchName);
  const envProjectPath = asNonEmptyString(parsed.envProjectPath);
  const githubToken = asNonEmptyString(parsed.githubToken);
  const repoUrl = asNonEmptyString(parsed.repoUrl);
  const ccAuthValue = asNonEmptyString(parsed.ccAuthValue);
  const ocModel = asNonEmptyString(parsed.ocModel);
  const gcOauthPath = asNonEmptyString(parsed.gcOauthPath);
  const gcApiKey = asNonEmptyString(parsed.gcApiKey);
  const gcModel = asNonEmptyString(parsed.gcModel);
  const cxAuthJsonPath = asNonEmptyString(parsed.cxAuthJsonPath);
  const cxApiKey = asNonEmptyString(parsed.cxApiKey);
  const cxModel = asNonEmptyString(parsed.cxModel);

  if (repoSource === "github") {
    if (!githubToken) {
      errors.push("githubToken is required when repoSource=github");
    }
    if (!repoUrl) {
      errors.push("repoUrl is required when repoSource=github");
    }
  }

  const ccAuthMethodRaw = parsed.ccAuthMethod;
  const ccAuthMethod =
    ccAuthMethodRaw === "oauth" || ccAuthMethodRaw === "apiKey"
      ? ccAuthMethodRaw
      : undefined;
  const ccModelRaw = parsed.ccModel;
  const ccModel =
    ccModelRaw === "sonnet" || ccModelRaw === "opus" || ccModelRaw === "haiku"
      ? ccModelRaw
      : undefined;

  const gcAuthMethodRaw = parsed.gcAuthMethod;
  const gcAuthMethod =
    gcAuthMethodRaw === "oauth" || gcAuthMethodRaw === "apiKey"
      ? gcAuthMethodRaw
      : undefined;

  const cxAuthMethodRaw = parsed.cxAuthMethod;
  const cxAuthMethod =
    cxAuthMethodRaw === "oauth" || cxAuthMethodRaw === "apiKey"
      ? cxAuthMethodRaw
      : undefined;

  if (codingAgent === "CC") {
    if (!ccAuthMethod) {
      errors.push("ccAuthMethod is required when codingAgent=CC");
    }
    if (!ccAuthValue) {
      errors.push("ccAuthValue is required when codingAgent=CC");
    }
    if (parsed.ccModel !== undefined && !ccModel) {
      errors.push("ccModel must be one of: sonnet, opus, haiku");
    }
  }

  if (codingAgent === "OC" && !ocModel) {
    errors.push("ocModel is required when codingAgent=OC");
  }

  if (codingAgent === "GC") {
    if (!gcAuthMethod) {
      errors.push("gcAuthMethod is required when codingAgent=GC");
    } else if (gcAuthMethod === "oauth" && !gcOauthPath) {
      errors.push("gcOauthPath is required when codingAgent=GC and gcAuthMethod=oauth");
    } else if (gcAuthMethod === "apiKey" && !gcApiKey) {
      errors.push("gcApiKey is required when codingAgent=GC and gcAuthMethod=apiKey");
    }
  }

  if (codingAgent === "CX") {
    if (!cxAuthMethod) {
      errors.push("cxAuthMethod is required when codingAgent=CX");
    } else if (cxAuthMethod === "oauth" && !cxAuthJsonPath) {
      errors.push("cxAuthJsonPath is required when codingAgent=CX and cxAuthMethod=oauth");
    } else if (cxAuthMethod === "apiKey" && !cxApiKey) {
      errors.push("cxApiKey is required when codingAgent=CX and cxAuthMethod=apiKey");
    }
  }

  const maxIterationsRaw = parsed.maxIterations;
  let maxIterations: number | undefined;
  if (maxIterationsRaw !== undefined) {
    if (typeof maxIterationsRaw !== "number" || !Number.isFinite(maxIterationsRaw)) {
      errors.push("maxIterations must be a number");
    } else if (maxIterationsRaw <= 0) {
      errors.push("maxIterations must be greater than 0");
    } else {
      maxIterations = Math.floor(maxIterationsRaw);
    }
  }

  if (errors.length > 0 || !codingAgent || !repoSource) {
    return { errors };
  }

  return {
    config: {
      codingAgent,
      repoSource,
      branchName,
      envProjectPath,
      maxIterations,
      githubToken,
      repoUrl,
      ccAuthMethod,
      ccAuthValue,
      ccModel,
      ocModel,
      gcAuthMethod,
      gcOauthPath,
      gcApiKey,
      gcModel,
      cxAuthMethod,
      cxAuthJsonPath,
      cxApiKey,
      cxModel,
    },
    errors: [],
  };
};

const toPromptInjectValues = (config: NonInteractiveConfig): unknown[] => {
  const values: unknown[] = [config.codingAgent];
  if (config.codingAgent === "CC") {
    values.push(config.ccAuthMethod, config.ccAuthValue, config.ccModel ?? "opus");
  } else if (config.codingAgent === "OC") {
    values.push(config.ocModel ?? "opencode/kimi-k2.5-free");
  } else if (config.codingAgent === "GC") {
    values.push(config.gcAuthMethod);
    if (config.gcAuthMethod === "oauth") {
      values.push(config.gcOauthPath);
    } else {
      values.push(config.gcApiKey);
    }
  } else {
    values.push(config.cxAuthMethod);
    if (config.cxAuthMethod === "oauth") {
      values.push(config.cxAuthJsonPath);
    } else {
      values.push(config.cxApiKey);
    }
    values.push(config.cxModel ?? "gpt-5.3-codex");
  }
  values.push(config.repoSource);
  if (config.repoSource === "github") {
    values.push(config.githubToken, config.repoUrl);
  }
  values.push(config.branchName ?? "main");
  values.push(config.envProjectPath ?? ".wile/.env.project");
  values.push(config.maxIterations ?? 25);
  return values;
};

const readEnvFile = async (path: string) => {
  if (!existsSync(path)) {
    return {} as Record<string, string>;
  }
  const contents = await readFile(path, "utf8");
  return dotenv.parse(contents);
};

const ensureGitignore = async (path: string) => {
  const entries = ["secrets/", "screenshots/", "logs/", ".env.project"];
  if (!existsSync(path)) {
    await writeFile(path, entries.join("\n") + "\n");
    return;
  }

  const existing = await readFile(path, "utf8");
  const lines = existing.split(/\r?\n/);
  const existingSet = new Set(lines.filter(Boolean));
  const additions = entries.filter((entry) => !existingSet.has(entry));

  if (additions.length === 0) {
    return;
  }

  const needsNewline = existing.length > 0 && !existing.endsWith("\n");
  const output =
    existing + (needsNewline ? "\n" : "") + additions.join("\n") + "\n";
  await writeFile(path, output);
};

const writeIfMissing = async (path: string, contents: string) => {
  if (!existsSync(path)) {
    await writeFile(path, contents);
  }
};

const coalesceValue = (value: string | undefined, fallback?: string) => {
  if (value === undefined) {
    return fallback;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return fallback;
  }
  return trimmed;
};

const onCancel = () => {
  console.log("Config cancelled.");
  process.exit(1);
};

const prompt = async (
  questions: prompts.PromptObject | prompts.PromptObject[],
) => prompts(questions, { onCancel });

const maybeInject = () => {
  const raw = process.env.WILE_PROMPTS_INJECT;
  if (!raw) {
    return;
  }
  try {
    const values = JSON.parse(raw) as unknown[];
    if (Array.isArray(values)) {
      prompts.inject(values);
    }
  } catch {
    console.warn("Warning: failed to parse WILE_PROMPTS_INJECT JSON.");
  }
};

const setIfDefined = (
  env: KnownEnv,
  key: EnvFileKey,
  value: string | undefined,
) => {
  if (value === undefined) {
    return;
  }
  env[key] = value;
};

const resolvePath = (cwd: string, input: string) => {
  const expanded = input.startsWith("~")
    ? join(homedir(), input.slice(1))
    : input;
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
};

const readBase64File = async (path: string) => {
  const contents = await readFile(path);
  return Buffer.from(contents).toString("base64");
};

export const runConfig = async (options: RunConfigOptions = {}) => {
  const nonInteractiveInput = options.nonInteractive;
  if (nonInteractiveInput === true) {
    process.stdout.write(renderNonInteractiveConfigHelp());
    return true;
  }

  let nonInteractiveConfig: NonInteractiveConfig | undefined;
  if (typeof nonInteractiveInput === "string") {
    const parsed = parseNonInteractiveConfig(nonInteractiveInput);
    if (!parsed.config) {
      process.stdout.write(renderNonInteractiveConfigHelp());
      process.stdout.write("\n");
      console.error("Error: invalid non-interactive config.");
      for (const error of parsed.errors) {
        console.error(`- ${error}`);
      }
      return false;
    }
    nonInteractiveConfig = parsed.config;
    prompts.inject(toPromptInjectValues(parsed.config));
  }

  const cwd = process.cwd();
  const wileDir = join(cwd, ".wile");
  const secretsDir = join(wileDir, "secrets");
  const envPath = join(secretsDir, ".env");
  const envProjectPath = join(wileDir, ".env.project");
  const gitignorePath = join(wileDir, ".gitignore");
  const prdPath = join(wileDir, "prd.json");
  const prdExamplePath = join(wileDir, "prd.json.example");
  const additionalInstructionsPath = join(
    wileDir,
    "additional-instructions.md",
  );
  const preflightPath = join(wileDir, "preflight.md");
  const agentsPath = join(wileDir, "AGENTS.md");

  await mkdir(secretsDir, { recursive: true });

  if (!nonInteractiveConfig) {
    maybeInject();
  }

  const { known: existingEnv, extra: extraEnv } = splitEnv(
    await readEnvFile(envPath),
  );

  const codingAgentResponse = await prompt({
    type: "select",
    name: "codingAgent",
    message: "Select coding agent",
    choices: [
      { title: "Claude Code (CC)", value: "CC" },
      { title: "Gemini CLI (GC)", value: "GC" },
      { title: "OpenCode (OC)", value: "OC" },
      { title: "Codex CLI (CX)", value: "CX" },
    ],
    initial:
      existingEnv.CODING_AGENT === "OC"
        ? 2
        : existingEnv.CODING_AGENT === "GC"
          ? 1
          : existingEnv.CODING_AGENT === "CX"
            ? 3
            : 0,
  });

  const codingAgent = codingAgentResponse.codingAgent as
    | "CC"
    | "OC"
    | "GC"
    | "CX";

  let authMethod: "oauth" | "apiKey" | null = null;
  let geminiAuthMethod: "oauth" | "apiKey" | null = null;
  let codexAuthMethod: "oauth" | "apiKey" | null = null;
  let authValueResponse: { authValue?: string } = {};
  let defaultModelResponse: { model?: string } = {};
  let ocModelResponse: { ocModel?: string } = {};
  let geminiOauthPathResponse: { geminiOauthPath?: string } = {};
  let geminiApiKeyResponse: { geminiApiKey?: string } = {};
  let codexAuthJsonPathResponse: { codexAuthJsonPath?: string } = {};
  let codexApiKeyResponse: { codexApiKey?: string } = {};
  let codexModelResponse: { codexModel?: string } = {};

  if (codingAgent === "CC") {
    const authDefault = existingEnv.CC_CLAUDE_CODE_OAUTH_TOKEN
      ? "oauth"
      : existingEnv.CC_ANTHROPIC_API_KEY
        ? "apiKey"
        : "oauth";

    const authResponse = await prompt({
      type: "select",
      name: "authMethod",
      message: "Claude Code authentication",
      choices: [
        { title: "OAuth token (Pro/Max subscription)", value: "oauth" },
        { title: "API key (Anthropic credits)", value: "apiKey" },
      ],
      initial: authDefault === "apiKey" ? 1 : 0,
    });

    authMethod = authResponse.authMethod as "oauth" | "apiKey";
    console.log("");
    console.log(authMethod === "oauth" ? tips.oauth : tips.apiKey);
    console.log("");

    authValueResponse = await prompt({
      type: "password",
      name: "authValue",
      message:
        authMethod === "oauth"
          ? "Claude Code OAuth token (press enter to keep existing)"
          : "Anthropic API key (press enter to keep existing)",
      initial:
        authMethod === "oauth"
          ? (existingEnv.CC_CLAUDE_CODE_OAUTH_TOKEN ?? "")
          : (existingEnv.CC_ANTHROPIC_API_KEY ?? ""),
    });

    defaultModelResponse = await prompt({
      type: "select",
      name: "model",
      message: "Default Claude model",
      choices: [
        { title: "sonnet", value: "sonnet" },
        { title: "opus", value: "opus" },
        { title: "haiku", value: "haiku" },
      ],
      initial:
        existingEnv.CC_CLAUDE_MODEL === "sonnet"
          ? 0
          : existingEnv.CC_CLAUDE_MODEL === "haiku"
            ? 2
            : 1,
    });
  } else if (codingAgent === "OC") {
    const existingNativeIdx = nativeOcModels.findIndex(
      (m) => m.value === existingEnv.OC_MODEL,
    );

    ocModelResponse = await prompt({
      type: "select",
      name: "ocModel",
      message: "OpenCode model (free)",
      choices: nativeOcModels,
      initial: existingNativeIdx >= 0 ? existingNativeIdx : 0,
    });
  } else if (codingAgent === "GC") {
    const geminiAuthDefault = existingEnv.GEMINI_OAUTH_CREDS_B64
      ? "oauth"
      : existingEnv.GEMINI_API_KEY
        ? "apiKey"
        : "oauth";

    const geminiAuthResponse = await prompt({
      type: "select",
      name: "geminiAuthMethod",
      message: "Gemini CLI authentication",
      choices: [
        { title: "OAuth (Google account)", value: "oauth" },
        { title: "API key (Gemini API)", value: "apiKey" },
      ],
      initial: geminiAuthDefault === "apiKey" ? 1 : 0,
    });

    geminiAuthMethod = geminiAuthResponse.geminiAuthMethod as
      | "oauth"
      | "apiKey";
    console.log("");
    console.log(
      geminiAuthMethod === "oauth" ? tips.geminiOauth : tips.geminiApiKey,
    );
    console.log("");

    if (geminiAuthMethod === "oauth") {
      const defaultOauthPath = "~/.gemini/oauth_creds.json";
      geminiOauthPathResponse = await prompt({
        type: "text",
        name: "geminiOauthPath",
        message: "Gemini OAuth creds file path (press enter to keep existing)",
        initial: defaultOauthPath,
      });
    } else {
      geminiApiKeyResponse = await prompt({
        type: "password",
        name: "geminiApiKey",
        message: "Gemini API key (press enter to keep existing)",
        initial: existingEnv.GEMINI_API_KEY ?? "",
      });
    }
  } else {
    const codexAuthDefault = existingEnv.CODEX_AUTH_JSON_B64
      ? "oauth"
      : existingEnv.CODEX_API_KEY || existingEnv.OPENAI_API_KEY
        ? "apiKey"
        : "oauth";

    const codexAuthResponse = await prompt({
      type: "select",
      name: "codexAuthMethod",
      message: "Codex CLI authentication",
      choices: [
        { title: "ChatGPT login (subscription)", value: "oauth" },
        { title: "API key (OpenAI API)", value: "apiKey" },
      ],
      initial: codexAuthDefault === "apiKey" ? 1 : 0,
    });

    codexAuthMethod = codexAuthResponse.codexAuthMethod as "oauth" | "apiKey";
    console.log("");
    console.log(
      codexAuthMethod === "oauth" ? tips.codexOauth : tips.codexApiKey,
    );
    console.log("");

    if (codexAuthMethod === "oauth") {
      const defaultAuthPath = "~/.codex/auth.json";
      codexAuthJsonPathResponse = await prompt({
        type: "text",
        name: "codexAuthJsonPath",
        message: "Codex auth.json path (press enter to keep existing)",
        initial: defaultAuthPath,
      });
    } else {
      codexApiKeyResponse = await prompt({
        type: "password",
        name: "codexApiKey",
        message: "OpenAI API key (press enter to keep existing)",
        initial: existingEnv.CODEX_API_KEY ?? existingEnv.OPENAI_API_KEY ?? "",
      });
    }

    codexModelResponse = await prompt({
      type: "text",
      name: "codexModel",
      message: "Codex model (press enter to keep existing)",
      initial: existingEnv.CODEX_MODEL ?? "gpt-5.3-codex",
    });
  }

  const repoSourceResponse = await prompt({
    type: "select",
    name: "repoSource",
    message: "Repo source",
    choices: [
      { title: "GitHub (remote)", value: "github" },
      { title: "Local directory (no GitHub)", value: "local" },
    ],
    initial: existingEnv.WILE_REPO_SOURCE === "local" ? 1 : 0,
  });

  const repoSource = repoSourceResponse.repoSource as "github" | "local";

  if (repoSource === "github") {
    console.log("");
    console.log(tips.github);
    console.log("");
  }

  const githubTokenResponse =
    repoSource === "github"
      ? await prompt({
          type: "password",
          name: "githubToken",
          message: "GitHub token (press enter to keep existing)",
          initial: existingEnv.GITHUB_TOKEN ?? "",
        })
      : { githubToken: undefined };

  const repoResponse =
    repoSource === "github"
      ? await prompt({
          type: "text",
          name: "repoUrl",
          message: "GitHub repo URL",
          initial: existingEnv.GITHUB_REPO_URL ?? "",
        })
      : { repoUrl: undefined };

  const branchResponse = await prompt({
    type: "text",
    name: "branchName",
    message: "Default GitHub branch name",
    initial: existingEnv.BRANCH_NAME ?? "main",
  });

  const envProjectPathResponse = await prompt({
    type: "text",
    name: "envProjectPath",
    message: "Project env file path to forward into the container",
    initial: existingEnv.WILE_ENV_PROJECT_PATH ?? ".wile/.env.project",
  });

  const iterationsResponse = await prompt({
    type: "number",
    name: "maxIterations",
    message: "Default max iterations",
    initial: existingEnv.WILE_MAX_ITERATIONS
      ? Number(existingEnv.WILE_MAX_ITERATIONS)
      : 25,
  });
  const fallbackIterations = existingEnv.WILE_MAX_ITERATIONS
    ? Number(existingEnv.WILE_MAX_ITERATIONS)
    : 25;
  const maxIterations =
    Number.isFinite(iterationsResponse.maxIterations) &&
    iterationsResponse.maxIterations > 0
      ? iterationsResponse.maxIterations
      : fallbackIterations;

  const authFallback =
    authMethod === "oauth"
      ? existingEnv.CC_CLAUDE_CODE_OAUTH_TOKEN
      : existingEnv.CC_ANTHROPIC_API_KEY;
  const authValue =
    codingAgent === "CC"
      ? coalesceValue(authValueResponse.authValue, authFallback)
      : undefined;
  const ocModel =
    codingAgent === "OC"
      ? coalesceValue(
          ocModelResponse.ocModel,
          existingEnv.OC_MODEL ?? "opencode/kimi-k2.5-free",
        )
      : undefined;
  const geminiApiKey =
    codingAgent === "GC"
      ? coalesceValue(
          geminiApiKeyResponse.geminiApiKey,
          existingEnv.GEMINI_API_KEY,
        )
      : undefined;
  const geminiModel =
    codingAgent === "GC"
      ? coalesceValue(
          nonInteractiveConfig?.gcModel,
          existingEnv.GEMINI_MODEL ?? "gemini-3-pro-preview",
        )
      : undefined;
  let geminiOauthCredsB64: string | undefined;
  if (codingAgent === "GC" && geminiAuthMethod === "oauth") {
    const configuredPath = coalesceValue(
      geminiOauthPathResponse.geminiOauthPath,
    );
    if (configuredPath) {
      const resolvedPath = resolvePath(cwd, configuredPath);
      try {
        geminiOauthCredsB64 = await readBase64File(resolvedPath);
      } catch {
        throw new Error(
          `Failed to read Gemini OAuth creds file: ${resolvedPath}`,
        );
      }
    } else {
      geminiOauthCredsB64 = existingEnv.GEMINI_OAUTH_CREDS_B64;
    }
  }
  const codexApiKey =
    codingAgent === "CX"
      ? coalesceValue(
          codexApiKeyResponse.codexApiKey,
          existingEnv.CODEX_API_KEY ?? existingEnv.OPENAI_API_KEY,
        )
      : undefined;
  let codexAuthJsonB64: string | undefined;
  if (codingAgent === "CX" && codexAuthMethod === "oauth") {
    const configuredPath = coalesceValue(
      codexAuthJsonPathResponse.codexAuthJsonPath,
    );
    if (configuredPath) {
      const resolvedPath = resolvePath(cwd, configuredPath);
      try {
        codexAuthJsonB64 = await readBase64File(resolvedPath);
      } catch {
        throw new Error(`Failed to read Codex auth.json file: ${resolvedPath}`);
      }
    } else {
      codexAuthJsonB64 = existingEnv.CODEX_AUTH_JSON_B64;
    }
  }
  const codexModel =
    codingAgent === "CX"
      ? coalesceValue(
          codexModelResponse.codexModel,
          existingEnv.CODEX_MODEL ?? "gpt-5.3-codex",
        )
      : undefined;
  const githubToken =
    repoSource === "github"
      ? coalesceValue(githubTokenResponse.githubToken, existingEnv.GITHUB_TOKEN)
      : existingEnv.GITHUB_TOKEN;
  const repoUrl =
    repoSource === "github"
      ? coalesceValue(repoResponse.repoUrl, existingEnv.GITHUB_REPO_URL)
      : existingEnv.GITHUB_REPO_URL;
  const envProjectPathValue =
    coalesceValue(
      envProjectPathResponse.envProjectPath,
      existingEnv.WILE_ENV_PROJECT_PATH ?? ".wile/.env.project",
    ) ?? ".wile/.env.project";
  const branchName = coalesceValue(
    branchResponse.branchName,
    existingEnv.BRANCH_NAME ?? "main",
  );

  const envOut: KnownEnv = { ...existingEnv };
  envOut.CODING_AGENT = codingAgent;
  envOut.WILE_REPO_SOURCE = repoSource;
  envOut.WILE_ENV_PROJECT_PATH = envProjectPathValue;
  envOut.BRANCH_NAME = branchName ?? "main";
  envOut.WILE_MAX_ITERATIONS = String(maxIterations);
  setIfDefined(envOut, "GITHUB_TOKEN", githubToken);
  setIfDefined(envOut, "GITHUB_REPO_URL", repoUrl);

  if (codingAgent === "CC") {
    setIfDefined(
      envOut,
      "CC_CLAUDE_MODEL",
      defaultModelResponse.model as string,
    );
    if (authMethod === "oauth") {
      setIfDefined(envOut, "CC_CLAUDE_CODE_OAUTH_TOKEN", authValue);
    } else {
      setIfDefined(envOut, "CC_ANTHROPIC_API_KEY", authValue);
    }
  } else if (codingAgent === "OC") {
    setIfDefined(envOut, "OC_MODEL", ocModel ?? "opencode/kimi-k2.5-free");
  } else if (codingAgent === "GC") {
    if (geminiAuthMethod === "apiKey") {
      setIfDefined(envOut, "GEMINI_API_KEY", geminiApiKey);
    } else {
      setIfDefined(envOut, "GEMINI_OAUTH_CREDS_B64", geminiOauthCredsB64);
    }
    setIfDefined(envOut, "GEMINI_MODEL", geminiModel);
  } else if (codingAgent === "CX") {
    if (codexAuthMethod === "apiKey") {
      setIfDefined(envOut, "CODEX_API_KEY", codexApiKey);
    } else {
      setIfDefined(envOut, "CODEX_AUTH_JSON_B64", codexAuthJsonB64);
    }
    setIfDefined(envOut, "CODEX_MODEL", codexModel);
  }

  await writeFile(envPath, toEnvString(envOut, extraEnv));

  await ensureGitignore(gitignorePath);

  const envProjectTarget =
    envProjectPathValue === ".wile/.env.project"
      ? envProjectPath
      : envProjectPathValue;
  const envProjectResolved = envProjectTarget.startsWith("/")
    ? envProjectTarget
    : join(cwd, envProjectTarget);
  if (envProjectResolved.startsWith(wileDir)) {
    await writeIfMissing(
      envProjectResolved,
      "# Add env vars here to forward into the container\n",
    );
  }

  if (!existsSync(prdPath)) {
    const prdContents = JSON.stringify({ stories: [] }, null, 2);
    await writeFile(prdPath, prdContents + "\n");
  }

  await writeIfMissing(
    prdExamplePath,
    JSON.stringify(prdExample, null, 2) + "\n",
  );

  const hadAdditionalInstructions = existsSync(additionalInstructionsPath);
  const hadPreflight = existsSync(preflightPath);
  await writeIfMissing(
    additionalInstructionsPath,
    '<!--\nUse bullet points for additional instructions, e.g.\n- You may run `supabase db reset --db-url "$SUPABASE_DB_URL"` when needed.\n- Do not ask for permission before running it.\n-->\n',
  );
  await writeIfMissing(
    preflightPath,
    '<!--\nUse bullet points for preflight checks, e.g.\n- Confirm SUPABASE_DB_URL is set.\n- Run `supabase db reset --db-url "$SUPABASE_DB_URL"`.\n-->\n',
  );

  await writeIfMissing(
    agentsPath,
    [
      "# PRD authoring guidance for Wile",
      "",
      "Wile reads `.wile/prd.json` each iteration, picks the first runnable story in `stories`",
      'where `status: "pending"`, implements exactly one story, marks it `done`, logs',
      "progress, and repeats until all stories are done. The PRD should be written so",
      "each story is independently actionable and verifiable.",
      "",
      "Guidelines:",
      "- Use outcome-focused acceptance criteria (observable results).",
      '- Criteria should be hard to satisfy with "empty" tests.',
      "- For integration tests, write acceptance criteria that validate real system behavior (not just the harness).",
      "- If verification is a command, state the expected result of that command.",
      "- Use one behavior per bullet.",
      "- Keep IDs stable, unique, and numeric (e.g., 1, 2, 3).",
      "- Never reuse IDs listed in any story's `compactedFrom` ranges.",
      '- Avoid vague terms like "should" or "nice".',
      "- Keep stories small enough to finish in one iteration.",
      '- Use `status: "pending"` for work not done yet and `status: "done"` only after all acceptance criteria are verified.',
      "- Use `dependsOn` to model prerequisites by story ID.",
      "- `dependsOn` must reference active story IDs only; never reference compacted IDs.",
      '- When compacting completed stories, add a canonical range string like `compactedFrom: "1..3,5"` to the summary done story.',
      "- Prefer concrete files/commands only when they reflect the real outcome.",
      "",
      "Environment notes:",
      "- Playwright (Chromium) is available in the agent container for UI checks.",
      "- Project env vars can be passed via `.wile/.env.project` (or override with WILE_ENV_PROJECT_PATH).",
      "- Optional extra guidance can be added in `.wile/additional-instructions.md`.",
      "- The container has outbound internet access by default.",
      "",
    ].join("\n"),
  );

  console.log("\nWile config complete.");
  console.log("Created PRD files in .wile/: prd.json and prd.json.example.");
  console.log("Add project env vars to .wile/.env.project when needed.");
  if (!hadAdditionalInstructions) {
    console.log(
      "Created .wile/additional-instructions.md for extra agent guidance (optional).",
    );
  }
  if (!hadPreflight) {
    console.log("Created .wile/preflight.md for preflight checks (optional).");
  }
  return true;
};
