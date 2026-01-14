import prompts from "prompts";
import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { homedir } from "node:os";

const prdExample = {
  userStories: [
    {
      id: "US-001",
      title: "Initialize project with Vite and React",
      acceptanceCriteria: [
        "package.json exists with vite, react, react-dom dependencies",
        "vite.config.ts configured for React",
        "src/main.tsx renders App component",
        "src/App.tsx exists with basic structure",
        "npm run dev starts dev server on port 5173",
        "npm run build produces dist/ folder",
      ],
      priority: 1,
      passes: false,
      notes: "Use TypeScript. Keep it minimal.",
    },
    {
      id: "US-002",
      title: "Create 3x3 game board component",
      acceptanceCriteria: [
        "src/components/Board.tsx exists",
        "Renders 3x3 grid of clickable squares",
        "Grid uses CSS Grid layout",
        "Each square is 100x100 pixels",
        "Board is centered on page",
        "Squares have visible borders",
      ],
      priority: 2,
      passes: false,
      notes: "Just the visual grid, no game logic yet",
    },
    {
      id: "US-003",
      title: "Implement alternating X and O turns",
      acceptanceCriteria: [
        "First click places X",
        "Second click places O",
        "Pattern continues alternating",
        "X displayed in blue color",
        "O displayed in red color",
        "Cannot click already-filled square",
      ],
      priority: 3,
      passes: false,
      notes: "Use React state for board and current player",
    },
    {
      id: "US-004",
      title: "Detect win condition",
      acceptanceCriteria: [
        "Detects horizontal wins (3 rows)",
        "Detects vertical wins (3 columns)",
        "Detects diagonal wins (2 diagonals)",
        "Shows 'X Wins!' or 'O Wins!' message when won",
        "Winning message appears above the board",
        "No more moves allowed after win",
      ],
      priority: 4,
      passes: false,
      notes: "Check all 8 possible winning combinations",
    },
    {
      id: "US-005",
      title: "Detect draw and add reset button",
      acceptanceCriteria: [
        "Shows 'Draw!' when all 9 squares filled with no winner",
        "Reset button appears below the board",
        "Clicking reset clears all squares",
        "Reset sets turn back to X",
        "Reset clears any win/draw message",
      ],
      priority: 5,
      passes: false,
      notes: "Complete the game loop",
    },
    {
      id: "US-006",
      title: "Add current turn indicator",
      acceptanceCriteria: [
        "Shows 'Current turn: X' or 'Current turn: O' above board",
        "Updates after each move",
        "Hidden when game is won or drawn",
        "X indicator in blue, O indicator in red",
      ],
      priority: 6,
      passes: false,
      notes: "Polish the UX",
    },
  ],
};

const tips = {
  oauth:
    "Tip: run 'claude setup-token' on your machine to generate an OAuth token (uses Pro/Max subscription).",
  apiKey: "Tip: create an Anthropic API key in the console (uses API credits).",
  openrouter:
    "Tip: create an OpenRouter API key at https://openrouter.ai/keys (pay per token).",
  github:
    "Tip: use a GitHub Personal Access Token (fine-grained recommended). Create at https://github.com/settings/tokens?type=beta with Contents (read/write) and Metadata (read).",
  geminiOauth:
    "Tip: run 'gemini' locally and choose Login with Google to create ~/.gemini/oauth_creds.json.",
  geminiApiKey:
    "Tip: create a Gemini API key at https://aistudio.google.com/app/apikey (pay per token).",
};

const nativeOcModels = [
  { title: "Grok Code Fast 1 (recommended)", value: "opencode/grok-code" },
  { title: "Big Pickle", value: "opencode/big-pickle" },
  { title: "GLM-4.7", value: "opencode/glm-4.7-free" },
  { title: "MiniMax M2.1", value: "opencode/minimax-m2.1-free" },
];

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

const resolvePath = (cwd: string, input: string) => {
  const expanded =
    input.startsWith("~") ? join(homedir(), input.slice(1)) : input;
  return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
};

const readBase64File = async (path: string) => {
  const contents = await readFile(path);
  return Buffer.from(contents).toString("base64");
};

export const runConfig = async () => {
  maybeInject();

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

  const existingEnv = await readEnvFile(envPath);

  const codingAgentResponse = await prompt({
    type: "select",
    name: "codingAgent",
    message: "Select coding agent",
    choices: [
      { title: "Claude Code (CC)", value: "CC" },
      { title: "Gemini CLI (GC)", value: "GC" },
      { title: "OpenCode (OC)", value: "OC" },
    ],
    initial: existingEnv.CODING_AGENT === "OC" ? 2 : existingEnv.CODING_AGENT === "GC" ? 1 : 0,
  });

  const codingAgent = codingAgentResponse.codingAgent as "CC" | "OC" | "GC";

  let authMethod: "oauth" | "apiKey" | null = null;
  let geminiAuthMethod: "oauth" | "apiKey" | null = null;
  let authValueResponse: { authValue?: string } = {};
  let defaultModelResponse: { model?: string } = {};
  let ocProviderResponse: { ocProvider?: string } = {};
  let ocKeyResponse: { ocKey?: string } = {};
  let ocModelResponse: { ocModel?: string } = {};
  let ocNativeModelResponse: { ocNativeModel?: string } = {};
  let geminiOauthPathResponse: { geminiOauthPath?: string } = {};
  let geminiApiKeyResponse: { geminiApiKey?: string } = {};

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
    const providerDefault = existingEnv.OC_PROVIDER === "openrouter" ? "openrouter" : "native";

    ocProviderResponse = await prompt({
      type: "select",
      name: "ocProvider",
      message: "OpenCode provider",
      choices: [
        { title: "Native free models (no API key)", value: "native" },
        { title: "OpenRouter (pay per token)", value: "openrouter" },
      ],
      initial: providerDefault === "openrouter" ? 1 : 0,
    });

    const ocProvider = ocProviderResponse.ocProvider as "native" | "openrouter";

    if (ocProvider === "openrouter") {
      console.log("");
      console.log(tips.openrouter);
      console.log("");

      ocKeyResponse = await prompt({
        type: "password",
        name: "ocKey",
        message: "OpenRouter API key (press enter to keep existing)",
        initial: existingEnv.OC_OPENROUTER_API_KEY ?? "",
      });

      ocModelResponse = await prompt({
        type: "select",
        name: "ocModel",
        message: "OpenCode model (OpenRouter)",
        choices: [{ title: "glm-4.7", value: "glm-4.7" }],
        initial: 0,
      });
    } else {
      const existingNativeIdx = nativeOcModels.findIndex(
        (m) => m.value === existingEnv.OC_MODEL,
      );

      ocNativeModelResponse = await prompt({
        type: "select",
        name: "ocNativeModel",
        message: "OpenCode model (free)",
        choices: nativeOcModels,
        initial: existingNativeIdx >= 0 ? existingNativeIdx : 0,
      });
    }
  } else {
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

    geminiAuthMethod = geminiAuthResponse.geminiAuthMethod as "oauth" | "apiKey";
    console.log("");
    console.log(geminiAuthMethod === "oauth" ? tips.geminiOauth : tips.geminiApiKey);
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
  const ocProvider =
    codingAgent === "OC"
      ? (ocProviderResponse.ocProvider as "native" | "openrouter") ?? "native"
      : undefined;
  const ocKey =
    codingAgent === "OC" && ocProvider === "openrouter"
      ? coalesceValue(ocKeyResponse.ocKey, existingEnv.OC_OPENROUTER_API_KEY)
      : undefined;
  const ocModel =
    codingAgent === "OC"
      ? ocProvider === "openrouter"
        ? coalesceValue(ocModelResponse.ocModel, existingEnv.OC_MODEL ?? "glm-4.7")
        : coalesceValue(ocNativeModelResponse.ocNativeModel, existingEnv.OC_MODEL ?? "opencode/grok-code")
      : undefined;
  const geminiApiKey =
    codingAgent === "GC"
      ? coalesceValue(geminiApiKeyResponse.geminiApiKey, existingEnv.GEMINI_API_KEY)
      : undefined;
  let geminiOauthCredsB64: string | undefined;
  if (codingAgent === "GC" && geminiAuthMethod === "oauth") {
    const configuredPath = coalesceValue(geminiOauthPathResponse.geminiOauthPath);
    if (configuredPath) {
      const resolvedPath = resolvePath(cwd, configuredPath);
      try {
        geminiOauthCredsB64 = await readBase64File(resolvedPath);
      } catch {
        throw new Error(`Failed to read Gemini OAuth creds file: ${resolvedPath}`);
      }
    } else {
      geminiOauthCredsB64 = existingEnv.GEMINI_OAUTH_CREDS_B64;
    }
  }
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

  const envLines = [
    `CODING_AGENT=${codingAgent}`,
    `WILE_REPO_SOURCE=${repoSource}`,
    `WILE_ENV_PROJECT_PATH=${envProjectPathValue}`,
    `GITHUB_TOKEN=${githubToken ?? ""}`,
    `GITHUB_REPO_URL=${repoUrl ?? ""}`,
    `BRANCH_NAME=${branchName ?? "main"}`,
    `WILE_MAX_ITERATIONS=${maxIterations}`,
  ];

  if (codingAgent === "CC") {
    envLines.push(`CC_CLAUDE_MODEL=${defaultModelResponse.model as string}`);
    if (authMethod === "oauth") {
      envLines.push(`CC_CLAUDE_CODE_OAUTH_TOKEN=${authValue ?? ""}`);
    } else {
      envLines.push(`CC_ANTHROPIC_API_KEY=${authValue ?? ""}`);
    }
  } else if (codingAgent === "OC") {
    envLines.push(`OC_PROVIDER=${ocProvider ?? "native"}`);
    envLines.push(`OC_MODEL=${ocModel ?? "opencode/grok-code"}`);
    if (ocProvider === "openrouter") {
      envLines.push(`OC_OPENROUTER_API_KEY=${ocKey ?? ""}`);
    }
  } else {
    if (geminiAuthMethod === "apiKey") {
      envLines.push(`GEMINI_API_KEY=${geminiApiKey ?? ""}`);
    } else {
      envLines.push(`GEMINI_OAUTH_CREDS_B64=${geminiOauthCredsB64 ?? ""}`);
    }
  }

  await writeFile(envPath, envLines.join("\n") + "\n");

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
    const prdContents = JSON.stringify({ userStories: [] }, null, 2);
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
      "Wile reads `.wile/prd.json` each iteration, picks the highest-priority story",
      "with `passes: false`, implements exactly one story, marks it complete, logs",
      "progress, and repeats until all stories pass. The PRD should be written so",
      "each story is independently actionable and verifiable.",
      "",
      "Guidelines:",
      "- Use outcome-focused acceptance criteria (observable results).",
      '- Criteria should be hard to satisfy with "empty" tests.',
      "- For integration tests, write acceptance criteria that validate real system behavior (not just the harness).",
      "- If verification is a command, state the expected result of that command.",
      "- Use one behavior per bullet.",
      "- Keep IDs stable and unique (e.g., US-123).",
      '- Avoid vague terms like "should" or "nice".',
      "- Keep stories small enough to finish in one iteration.",
      "- Mark `passes: false` for work not done yet.",
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
  console.log("Add project env vars to .wile/.env.project when needed.");
  if (!hadAdditionalInstructions) {
    console.log(
      "Created .wile/additional-instructions.md for extra agent guidance (optional).",
    );
  }
  if (!hadPreflight) {
    console.log("Created .wile/preflight.md for preflight checks (optional).");
  }
};
