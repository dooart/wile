#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_TEST="$ROOT_DIR/.wile/secrets/.env.test"

if [ ! -f "$ENV_TEST" ]; then
  echo "error: missing $ENV_TEST" >&2
  exit 1
fi

set -a
. "$ENV_TEST"
set +a

if [ -z "${CC_CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${CC_ANTHROPIC_API_KEY:-}" ]; then
  echo "error: CC_CLAUDE_CODE_OAUTH_TOKEN or CC_ANTHROPIC_API_KEY must be set in .env.test" >&2
  exit 1
fi

TMP_ROOT=$(mktemp -d /tmp/wile-claude-logs-real-XXXXXX)
REPO_DIR="$TMP_ROOT/repo"
ORIGIN_DIR="$REPO_DIR/origin.git"

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

git init "$REPO_DIR" >/dev/null
cd "$REPO_DIR"
git checkout -b main >/dev/null
git init --bare "$ORIGIN_DIR" >/dev/null
git remote add origin "$ORIGIN_DIR"

git config user.email "test@local"
git config user.name "Wile Test"

echo "# Wile Claude logs real test" > README.md
mkdir -p .wile/secrets
printf "secrets/\nscreenshots/\nlogs/\n" > .wile/.gitignore
printf "# Wile Progress Log\n\n## Codebase Patterns\n\n---\n" > .wile/progress.txt

cat > .wile/prd.json <<'JSON'
{
  "userStories": [
    {
      "id": "US-LOG-REAL-001",
      "title": "Write a small marker file",
      "acceptanceCriteria": [
        "Create integration-log.txt containing the text REAL LOG TEST"
      ],
      "priority": 1,
      "passes": false
    }
  ]
}
JSON

cat > .wile/additional-instructions.md <<'MD'
- Include the exact line "REAL LOG TEST" in your response output.
MD

git add -A
git commit -m "chore: seed real claude log test" >/dev/null
git push -u origin main >/dev/null

cp "$ENV_TEST" .wile/secrets/.env
if grep -q "^WILE_MOCK_CLAUDE=" .wile/secrets/.env; then
  sed -i '' "s/^WILE_MOCK_CLAUDE=.*/WILE_MOCK_CLAUDE=false/" .wile/secrets/.env
fi

if grep -q "^WILE_REPO_SOURCE=" .wile/secrets/.env; then
  sed -i '' "s/^WILE_REPO_SOURCE=.*/WILE_REPO_SOURCE=local/" .wile/secrets/.env
else
  echo "WILE_REPO_SOURCE=local" >> .wile/secrets/.env
fi

if grep -q "^BRANCH_NAME=" .wile/secrets/.env; then
  sed -i '' "s/^BRANCH_NAME=.*/BRANCH_NAME=main/" .wile/secrets/.env
else
  echo "BRANCH_NAME=main" >> .wile/secrets/.env
fi

export WILE_AGENT_DIR="$ROOT_DIR/packages/agent"
node "$ROOT_DIR/packages/cli/dist/cli.js" run --max-iterations 3

LOG_FILE=$(ls .wile/logs/run-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected run log file" >&2
  exit 1
fi

grep -q "REAL LOG TEST" "$LOG_FILE"
grep -q "\\[tool\\]" "$LOG_FILE"

echo "test-claude-logs-real: ok"
