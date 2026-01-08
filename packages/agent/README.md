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
4. Reads `.wile/prd.json` from repo
5. Loops through user stories, implementing one per iteration:
   - Picks highest priority story where `passes: false`
   - Implements the feature/fix
   - Runs tests and typecheck
   - Commits and pushes
   - Marks story as complete
   - Logs learnings
6. Repeats until all stories pass or max iterations reached

## Project Structure

Your repository must have a `.wile/` folder:

```
your-repo/
├── .wile/
│   ├── prd.json          # User stories (required)
│   ├── progress.txt      # Learnings log (created by agent)
│   └── screenshots/      # Visual verification (created by agent)
└── ... your code ...
```

## .wile/prd.json Format

```json
{
  "branchName": "feature/my-feature",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add login form",
      "acceptanceCriteria": [
        "Email/password fields exist",
        "Form validates email format",
        "typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": "Optional notes"
    }
  ]
}
```

### Fields

- `id`: Unique identifier (used in commit messages)
- `title`: Short description
- `acceptanceCriteria`: List of requirements (be specific!)
- `priority`: Lower number = done first
- `passes`: Set to `true` by the agent when complete
- `notes`: Optional context for the agent

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
| `CC_CLAUDE_CODE_OAUTH_TOKEN` | Yes* | OAuth token from `claude setup-token` (uses Pro/Max subscription) |
| `CC_ANTHROPIC_API_KEY` | Yes* | API key (uses API credits - alternative to OAuth) |
| `GITHUB_TOKEN` | Yes | GitHub PAT with repo access |
| `GITHUB_REPO_URL` | Yes | HTTPS URL to repository |
| `BRANCH_NAME` | Yes | Branch to work on |
| `MAX_ITERATIONS` | No | Max loops (default: 25) |
| `CC_CLAUDE_MODEL` | No | Claude model alias/name (default: sonnet) |

*Either `CC_CLAUDE_CODE_OAUTH_TOKEN` or `CC_ANTHROPIC_API_KEY` is required, not both.

## Output Files

The `.wile/` folder is **tracked in git** (except screenshots):

- `prd.json` - User stories / Product Requirements Document
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
git show origin/your-branch:.wile/prd.json | jq '.userStories[] | {id, title, passes}'
```
