# Wile Agent

Autonomous AI coding agent that runs in a Docker container. Ships features while you sleep.

## Quick Start

### 1. Set up your environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 2. Build and run

```bash
docker compose up --build
```

## How It Works

1. Container clones your repository
2. Checks out the specified branch
3. **Iteration 0 (Setup)**: Sets up .gitignore, initializes progress.txt
4. Reads `.wile/prd.json`
5. Loops through stories, implementing one per iteration:
   - Picks first runnable story in array order where `status: "pending"` and dependencies are done
   - Implements the feature/fix
   - Runs tests and typecheck
   - Marks story as done
   - Logs learnings
   - Commits changes
6. Repeats until all stories are done or max iterations reached

## Project Structure

Your repository must have a `.wile/prd.json` file:

```
your-repo/
├── .wile/
│   ├── prd.json          # Stories backlog (required)
│   ├── progress.txt      # Learnings log (created by agent)
│   └── screenshots/      # Visual verification (created by agent)
└── ... your code ...
```

## .wile/prd.json Format

```json
{
  "stories": [
    {
      "id": 1,
      "title": "Add login form",
      "description": "Email/password form with validation",
      "acceptanceCriteria": [
        "Email/password fields exist",
        "Form validates email format",
        "typecheck passes"
      ],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
```

### Fields

- `id`: Unique numeric identifier
- `title`: Short description
- `description`: Additional context for implementation
- `acceptanceCriteria`: List of requirements (be specific!)
- `dependsOn`: Array of prerequisite story IDs
- `status`: `pending` or `done`

## Tips for Success

### Write Small Stories
Each story should fit in one context window. Break large features into steps.

```
❌ "Build entire auth system"
✅ "Add login form"
✅ "Add email validation"
✅ "Add login API endpoint"
```

### Be Explicit in Criteria
Vague criteria lead to incomplete work.

```
❌ "Users can log in"
✅ "Email field with type=email"
✅ "Password field with minlength=8"
✅ "Submit button disabled when fields empty"
✅ "Shows error toast on invalid credentials"
```

### Include Verification Steps
For UI work, tell the agent how to verify:

```
"Verify login form at localhost:3000/login"
"Take screenshot of completed form"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CODING_AGENT` | No | `CC` (Claude Code, default), `GC` (Gemini CLI), `OC` (OpenCode via OpenRouter), or `CX` (Codex CLI) |
| `CC_CLAUDE_CODE_OAUTH_TOKEN` | Yes* | OAuth token from `claude setup-token` (uses Pro/Max subscription) |
| `CC_ANTHROPIC_API_KEY` | Yes* | API key (uses API credits - alternative to OAuth) |
| `GEMINI_OAUTH_CREDS_B64` | Yes (GC)* | Base64 OAuth creds from `~/.gemini/oauth_creds.json` (uses Google account) |
| `GEMINI_API_KEY` | Yes (GC)* | Gemini API key (uses API credits - alternative to OAuth) |
| `OC_OPENROUTER_API_KEY` | Yes (OC) | OpenRouter API key for OpenCode |
| `OC_MODEL` | Yes (OC) | OpenRouter model id (set `glm-4.7` to target `openrouter/z-ai/glm-4.7`) |
| `CODEX_AUTH_JSON_B64` | Yes (CX)* | Base64 of `~/.codex/auth.json` from `codex login` (uses ChatGPT subscription) |
| `CODEX_API_KEY` | Yes (CX)* | OpenAI API key (uses API credits - alternative to auth.json) |
| `GEMINI_MODEL` | No (GC) | Gemini model name (default: `auto-gemini-3`) |
| `WILE_REPO_SOURCE` | No | `github` (default) or `local` |
| `GITHUB_TOKEN` | Yes (github) | GitHub PAT with repo access |
| `GITHUB_REPO_URL` | Yes (github) | HTTPS URL to repository |
| `BRANCH_NAME` | Yes (github) | Branch to work on |
| `MAX_ITERATIONS` | No | Max loops (default: 25) |
| `CC_CLAUDE_MODEL` | No | Claude model alias/name (default: sonnet) |
| `CODEX_MODEL` | No (CX) | Codex model name (defaults to Codex CLI default) |

*Either `CC_CLAUDE_CODE_OAUTH_TOKEN` or `CC_ANTHROPIC_API_KEY` is required when `CODING_AGENT=CC`.  
*Either `GEMINI_OAUTH_CREDS_B64` or `GEMINI_API_KEY` is required when `CODING_AGENT=GC`.  
*Either `CODEX_AUTH_JSON_B64` or `CODEX_API_KEY` is required when `CODING_AGENT=CX`.

## Output Files

Tracked artifacts:

- `.wile/prd.json` - Product requirements stories backlog
- `progress.txt` - Log of completed work and learnings
- `screenshots/` - Visual verification screenshots (gitignored)

## Monitoring Progress

Watch commits appear on your branch:

```bash
git log --oneline origin/your-branch
```

Check the progress log:

```bash
git show origin/your-branch:.wile/progress.txt
```

Check story status:

```bash
git show origin/your-branch:.wile/prd.json | jq '.stories[] | {id, title, status}'
```
