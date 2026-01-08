import prompts from "prompts";
import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

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
        "npm run build produces dist/ folder"
      ],
      priority: 1,
      passes: true,
      notes: "Use TypeScript. Keep it minimal."
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
        "Squares have visible borders"
      ],
      priority: 2,
      passes: true,
      notes: "Just the visual grid, no game logic yet"
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
        "Cannot click already-filled square"
      ],
      priority: 3,
      passes: true,
      notes: "Use React state for board and current player"
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
        "No more moves allowed after win"
      ],
      priority: 4,
      passes: true,
      notes: "Check all 8 possible winning combinations"
    },
    {
      id: "US-005",
      title: "Detect draw and add reset button",
      acceptanceCriteria: [
        "Shows 'Draw!' when all 9 squares filled with no winner",
        "Reset button appears below the board",
        "Clicking reset clears all squares",
        "Reset sets turn back to X",
        "Reset clears any win/draw message"
      ],
      priority: 5,
      passes: true,
      notes: "Complete the game loop"
    },
    {
      id: "US-006",
      title: "Add current turn indicator",
      acceptanceCriteria: [
        "Shows 'Current turn: X' or 'Current turn: O' above board",
        "Updates after each move",
        "Hidden when game is won or drawn",
        "X indicator in blue, O indicator in red"
      ],
      priority: 6,
      passes: true,
      notes: "Polish the UX"
    }
  ]
};

const tips = {
  oauth:
    "Tip: run 'claude setup-token' on your machine to generate an OAuth token (uses Pro/Max subscription).",
  apiKey:
    "Tip: create an Anthropic API key in the console (uses API credits).",
  github:
    "Tip: use a GitHub Personal Access Token (fine-grained recommended). Create at https://github.com/settings/tokens?type=beta with Contents (read/write) and Metadata (read)."
};

const readEnvFile = async (path: string) => {
  if (!existsSync(path)) {
    return {} as Record<string, string>;
  }
  const contents = await readFile(path, "utf8");
  return dotenv.parse(contents);
};

const ensureGitignore = async (path: string) => {
  const entries = ["secrets/", "screenshots/", "logs/"];
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
    existing +
    (needsNewline ? "\n" : "") +
    additions.join("\n") +
    "\n";
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

const prompt = async <T>(questions: prompts.PromptObject<T> | prompts.PromptObject<T>[]) =>
  prompts(questions, { onCancel });

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

export const runConfig = async () => {
  maybeInject();

  const cwd = process.cwd();
  const wileDir = join(cwd, ".wile");
  const secretsDir = join(wileDir, "secrets");
  const envPath = join(secretsDir, ".env");
  const envProjectPath = join(secretsDir, ".env.project");
  const gitignorePath = join(wileDir, ".gitignore");
  const prdPath = join(wileDir, "prd.json");
  const prdExamplePath = join(wileDir, "prd.json.example");
  const additionalInstructionsPath = join(wileDir, "additional-instructions.md");

  await mkdir(secretsDir, { recursive: true });

  const existingEnv = await readEnvFile(envPath);

  await prompt({
    type: "select",
    name: "codingAgent",
    message: "Select coding agent",
    choices: [{ title: "Claude Code (CC)", value: "CC" }],
    initial: 0
  });

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
      { title: "API key (Anthropic credits)", value: "apiKey" }
    ],
    initial: authDefault === "apiKey" ? 1 : 0
  });

  const authMethod = authResponse.authMethod as "oauth" | "apiKey";
  console.log("");
  console.log(authMethod === "oauth" ? tips.oauth : tips.apiKey);
  console.log("");

  const authValueResponse = await prompt({
    type: "password",
    name: "authValue",
    message:
      authMethod === "oauth"
        ? "Claude Code OAuth token (press enter to keep existing)"
        : "Anthropic API key (press enter to keep existing)",
    initial:
      authMethod === "oauth"
        ? existingEnv.CC_CLAUDE_CODE_OAUTH_TOKEN ?? ""
        : existingEnv.CC_ANTHROPIC_API_KEY ?? ""
  });

  const defaultModelResponse = await prompt({
    type: "select",
    name: "model",
    message: "Default Claude model",
    choices: [
      { title: "sonnet", value: "sonnet" },
      { title: "opus", value: "opus" }
    ],
    initial: existingEnv.CC_CLAUDE_MODEL === "opus" ? 1 : 0
  });

  const repoSourceResponse = await prompt({
    type: "select",
    name: "repoSource",
    message: "Repo source",
    choices: [
      { title: "GitHub (remote)", value: "github" },
      { title: "Local directory (no GitHub)", value: "local" }
    ],
    initial: existingEnv.WILE_REPO_SOURCE === "local" ? 1 : 0
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
          initial: existingEnv.GITHUB_TOKEN ?? ""
        })
      : { githubToken: undefined };

  const repoResponse =
    repoSource === "github"
      ? await prompt({
          type: "text",
          name: "repoUrl",
          message: "GitHub repo URL",
          initial: existingEnv.GITHUB_REPO_URL ?? ""
        })
      : { repoUrl: undefined };

  const branchResponse = await prompt({
    type: "text",
    name: "branchName",
    message: "Default branch name",
    initial: existingEnv.BRANCH_NAME ?? "main"
  });

  const authFallback =
    authMethod === "oauth"
      ? existingEnv.CC_CLAUDE_CODE_OAUTH_TOKEN
      : existingEnv.CC_ANTHROPIC_API_KEY;
  const authValue = coalesceValue(authValueResponse.authValue, authFallback);
  const githubToken =
    repoSource === "github"
      ? coalesceValue(githubTokenResponse.githubToken, existingEnv.GITHUB_TOKEN)
      : existingEnv.GITHUB_TOKEN;
  const repoUrl =
    repoSource === "github"
      ? coalesceValue(repoResponse.repoUrl, existingEnv.GITHUB_REPO_URL)
      : existingEnv.GITHUB_REPO_URL;
  const branchName = coalesceValue(
    branchResponse.branchName,
    existingEnv.BRANCH_NAME ?? "main"
  );

  const envLines = [
    "CODING_AGENT=CC",
    `WILE_REPO_SOURCE=${repoSource}`,
    `GITHUB_TOKEN=${githubToken ?? ""}`,
    `GITHUB_REPO_URL=${repoUrl ?? ""}`,
    `BRANCH_NAME=${branchName ?? "main"}`,
    `CC_CLAUDE_MODEL=${defaultModelResponse.model as string}`
  ];

  if (authMethod === "oauth") {
    envLines.push(`CC_CLAUDE_CODE_OAUTH_TOKEN=${authValue ?? ""}`);
  } else {
    envLines.push(`CC_ANTHROPIC_API_KEY=${authValue ?? ""}`);
  }

  await writeFile(envPath, envLines.join("\n") + "\n");

  await ensureGitignore(gitignorePath);

  await writeIfMissing(
    envProjectPath,
    "# Add env vars here to forward into the container\n"
  );

  if (!existsSync(prdPath)) {
    const prdContents = JSON.stringify({ userStories: [] }, null, 2);
    await writeFile(prdPath, prdContents + "\n");
  }

  await writeIfMissing(prdExamplePath, JSON.stringify(prdExample, null, 2) + "\n");

  const hadAdditionalInstructions = existsSync(additionalInstructionsPath);
  await writeIfMissing(
    additionalInstructionsPath,
    "<!--\nUse bullet points for additional instructions, e.g.\n- You may run `supabase db reset --db-url \"$SUPABASE_DB_URL\"` when needed.\n- Do not ask for permission before running it.\n-->\n"
  );

  console.log("\nWile config complete.");
  console.log(
    "Add project env vars to .wile/secrets/.env.project when needed."
  );
  if (!hadAdditionalInstructions) {
    console.log(
      "Created .wile/additional-instructions.md for extra agent guidance (optional)."
    );
  }
};
