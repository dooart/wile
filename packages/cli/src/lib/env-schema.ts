type EnvSection = "core" | "github" | "claude" | "opencode" | "gemini" | "codex";

type EnvVarDocEntry = {
  key: string;
  section: EnvSection;
  description: string;
  requiredWhen: string;
  defaultValue?: string;
  secret?: boolean;
};

export const ENV_VAR_DOC = [
  {
    key: "CODING_AGENT",
    section: "core",
    description: "Agent to run: CC (Claude), GC (Gemini), OC (OpenCode), CX (Codex).",
    requiredWhen: "Always.",
    defaultValue: "CC"
  },
  {
    key: "WILE_REPO_SOURCE",
    section: "core",
    description: "Where to get the repo from.",
    requiredWhen: "Always.",
    defaultValue: "github"
  },
  {
    key: "WILE_ENV_PROJECT_PATH",
    section: "core",
    description: "Path to project env file forwarded into Docker.",
    requiredWhen: "Optional.",
    defaultValue: ".wile/.env.project"
  },
  {
    key: "WILE_MAX_ITERATIONS",
    section: "core",
    description: "Default max loop iterations for `wile run`.",
    requiredWhen: "Optional.",
    defaultValue: "25"
  },
  {
    key: "GITHUB_TOKEN",
    section: "github",
    description: "GitHub token used for clone/push in GitHub repo mode.",
    requiredWhen: "Required when `WILE_REPO_SOURCE=github`.",
    secret: true
  },
  {
    key: "GITHUB_REPO_URL",
    section: "github",
    description: "Repository URL to clone in GitHub repo mode.",
    requiredWhen: "Required when `WILE_REPO_SOURCE=github`."
  },
  {
    key: "BRANCH_NAME",
    section: "github",
    description: "Branch Wile checks out and pushes to.",
    requiredWhen: "Required when `WILE_REPO_SOURCE=github`.",
    defaultValue: "main"
  },
  {
    key: "CC_CLAUDE_MODEL",
    section: "claude",
    description: "Claude model (`sonnet`, `opus`, `haiku`).",
    requiredWhen: "When `CODING_AGENT=CC`.",
    defaultValue: "opus"
  },
  {
    key: "CC_CLAUDE_CODE_OAUTH_TOKEN",
    section: "claude",
    description: "Claude Code OAuth token (subscription auth).",
    requiredWhen: "One of this or `CC_ANTHROPIC_API_KEY` when `CODING_AGENT=CC`.",
    secret: true
  },
  {
    key: "CC_ANTHROPIC_API_KEY",
    section: "claude",
    description: "Anthropic API key (pay-per-token auth).",
    requiredWhen: "One of this or `CC_CLAUDE_CODE_OAUTH_TOKEN` when `CODING_AGENT=CC`.",
    secret: true
  },
  {
    key: "OC_MODEL",
    section: "opencode",
    description: "OpenCode model id (native/free model).",
    requiredWhen: "Required when `CODING_AGENT=OC`.",
    defaultValue: "opencode/kimi-k2.5-free"
  },
  {
    key: "GEMINI_OAUTH_CREDS_B64",
    section: "gemini",
    description: "Base64-encoded `~/.gemini/oauth_creds.json`.",
    requiredWhen: "One of this or `GEMINI_API_KEY` when `CODING_AGENT=GC`.",
    secret: true
  },
  {
    key: "GEMINI_API_KEY",
    section: "gemini",
    description: "Gemini API key.",
    requiredWhen: "One of this or `GEMINI_OAUTH_CREDS_B64` when `CODING_AGENT=GC`.",
    secret: true
  },
  {
    key: "GEMINI_MODEL",
    section: "gemini",
    description: "Gemini model id.",
    requiredWhen: "When `CODING_AGENT=GC`.",
    defaultValue: "gemini-3-pro-preview"
  },
  {
    key: "CODEX_AUTH_JSON_B64",
    section: "codex",
    description: "Base64-encoded `~/.codex/auth.json` (subscription auth).",
    requiredWhen:
      "One of this, `CODEX_AUTH_JSON_PATH`, `CODEX_API_KEY`, or `OPENAI_API_KEY` when `CODING_AGENT=CX`.",
    secret: true
  },
  {
    key: "CODEX_AUTH_JSON_PATH",
    section: "codex",
    description: "Path to `~/.codex/auth.json` (used by `wile config`, then encoded).",
    requiredWhen:
      "Optional. Can be used instead of `CODEX_AUTH_JSON_B64` when generating config interactively."
  },
  {
    key: "CODEX_API_KEY",
    section: "codex",
    description: "OpenAI API key for Codex API-key auth.",
    requiredWhen:
      "One of this, `OPENAI_API_KEY`, `CODEX_AUTH_JSON_B64`, or `CODEX_AUTH_JSON_PATH` when `CODING_AGENT=CX`.",
    secret: true
  },
  {
    key: "OPENAI_API_KEY",
    section: "codex",
    description: "Alias fallback for `CODEX_API_KEY`.",
    requiredWhen:
      "Optional alias; counts as Codex API key when `CODING_AGENT=CX`.",
    secret: true
  },
  {
    key: "CODEX_MODEL",
    section: "codex",
    description: "Codex model override.",
    requiredWhen: "When `CODING_AGENT=CX`.",
    defaultValue: "gpt-5.3-codex"
  }
] as const satisfies readonly EnvVarDocEntry[];

export type EnvFileKey = (typeof ENV_VAR_DOC)[number]["key"];
export type KnownEnv = Partial<Record<EnvFileKey, string>>;

const sectionTitles: Record<EnvSection, string> = {
  core: "Core",
  github: "GitHub Source",
  claude: "Claude Agent (CC)",
  opencode: "OpenCode Agent (OC)",
  gemini: "Gemini Agent (GC)",
  codex: "Codex Agent (CX)"
};

export const ENV_FILE_KEY_ORDER: readonly EnvFileKey[] = ENV_VAR_DOC.map(
  (entry) => entry.key
);

const knownKeySet = new Set<string>(ENV_FILE_KEY_ORDER);

export const isEnvFileKey = (key: string): key is EnvFileKey => knownKeySet.has(key);

export const splitEnv = (raw: Record<string, string>): { known: KnownEnv; extra: Record<string, string> } => {
  const known: KnownEnv = {};
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isEnvFileKey(key)) {
      known[key] = value;
      continue;
    }
    extra[key] = value;
  }
  return { known, extra };
};

export const toEnvString = (known: KnownEnv, extra: Record<string, string> = {}) => {
  const ordered = ENV_FILE_KEY_ORDER.filter((key) => known[key] !== undefined);
  const rest = Object.keys(extra).sort();
  const lines = [...ordered, ...rest].map((key) =>
    `${key}=${known[key as EnvFileKey] ?? extra[key]}`
  );
  return lines.join("\n") + "\n";
};

export const renderEnvDocMarkdown = () => {
  const lines: string[] = [];
  lines.push("# Wile `.wile/secrets/.env` Reference");
  lines.push("");
  lines.push("Use this to create `.wile/secrets/.env` without interactive `wile config`.");
  lines.push("`wile config` and this doc are generated from the same schema in code.");
  lines.push("");
  lines.push("## Minimal templates");
  lines.push("");
  lines.push("GitHub + Claude OAuth:");
  lines.push("```env");
  lines.push("CODING_AGENT=CC");
  lines.push("WILE_REPO_SOURCE=github");
  lines.push("GITHUB_TOKEN=...");
  lines.push("GITHUB_REPO_URL=https://github.com/owner/repo");
  lines.push("BRANCH_NAME=main");
  lines.push("CC_CLAUDE_MODEL=opus");
  lines.push("CC_CLAUDE_CODE_OAUTH_TOKEN=...");
  lines.push("WILE_ENV_PROJECT_PATH=.wile/.env.project");
  lines.push("WILE_MAX_ITERATIONS=25");
  lines.push("```");
  lines.push("");
  lines.push("Local repo + OpenCode:");
  lines.push("```env");
  lines.push("CODING_AGENT=OC");
  lines.push("WILE_REPO_SOURCE=local");
  lines.push("OC_MODEL=opencode/kimi-k2.5-free");
  lines.push("WILE_ENV_PROJECT_PATH=.wile/.env.project");
  lines.push("WILE_MAX_ITERATIONS=25");
  lines.push("```");
  lines.push("");
  lines.push("Local repo + Gemini OAuth:");
  lines.push("```env");
  lines.push("CODING_AGENT=GC");
  lines.push("WILE_REPO_SOURCE=local");
  lines.push("GEMINI_OAUTH_CREDS_B64=...");
  lines.push("GEMINI_MODEL=gemini-3-pro-preview");
  lines.push("WILE_ENV_PROJECT_PATH=.wile/.env.project");
  lines.push("WILE_MAX_ITERATIONS=25");
  lines.push("```");
  lines.push("");
  lines.push("Local repo + Codex API key:");
  lines.push("```env");
  lines.push("CODING_AGENT=CX");
  lines.push("WILE_REPO_SOURCE=local");
  lines.push("CODEX_API_KEY=...");
  lines.push("CODEX_MODEL=gpt-5.3-codex");
  lines.push("WILE_ENV_PROJECT_PATH=.wile/.env.project");
  lines.push("WILE_MAX_ITERATIONS=25");
  lines.push("```");
  lines.push("");

  const sections: EnvSection[] = ["core", "github", "claude", "opencode", "gemini", "codex"];
  for (const section of sections) {
    lines.push(`## ${sectionTitles[section]}`);
    lines.push("");
    for (const entry of ENV_VAR_DOC.filter((item) => item.section === section)) {
      const traits: string[] = [entry.requiredWhen];
      if ("defaultValue" in entry && entry.defaultValue !== undefined) {
        traits.push(`Default: \`${entry.defaultValue}\``);
      }
      if ("secret" in entry && entry.secret) {
        traits.push("Secret");
      }
      lines.push(`- \`${entry.key}\`: ${entry.description} ${traits.join(" ")}`);
    }
    lines.push("");
  }

  lines.push("## Notes");
  lines.push("");
  lines.push("- If `WILE_REPO_SOURCE=local`, GitHub keys are not required.");
  lines.push("- For each agent, only one valid auth path is required.");
  lines.push(
    "- Optional custom image customization lives in `.wile/Dockerfile` and should extend `wile-agent:base`."
  );
  lines.push("- Keep `.wile/secrets/.env` out of version control.");
  lines.push("");
  return lines.join("\n");
};
