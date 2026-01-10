#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_TEST="$ROOT_DIR/.wile/secrets/.env.test"
TEST_BRANCH="integration-test"

if [ ! -f "$ENV_TEST" ]; then
  echo "error: missing $ENV_TEST" >&2
  exit 1
fi

set -a
. "$ENV_TEST"
set +a

if [ -z "${GITHUB_REPO_URL:-}" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "error: GITHUB_REPO_URL and GITHUB_TOKEN must be set in .env.test" >&2
  exit 1
fi

case "$GITHUB_REPO_URL" in
  https://*)
    AUTH_URL=$(echo "$GITHUB_REPO_URL" | sed "s|https://|https://x-access-token:${GITHUB_TOKEN}@|")
    ;;
  git@*)
    AUTH_URL=$(echo "$GITHUB_REPO_URL" | sed -E "s|git@([^:]+):|https://x-access-token:${GITHUB_TOKEN}@\\1/|")
    ;;
  *)
    echo "error: unsupported GITHUB_REPO_URL format" >&2
    exit 1
    ;;
esac

TMP_ROOT=$(mktemp -d /tmp/wile-opencode-logs-real-XXXXXX)
REPO_DIR="$TMP_ROOT/repo"
RUN_DIR="$TMP_ROOT/run"

cleanup() {
  if git ls-remote --exit-code --heads "$AUTH_URL" "$TEST_BRANCH" >/dev/null 2>&1; then
    git push "$AUTH_URL" --delete "$TEST_BRANCH" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

if git ls-remote --exit-code --heads "$AUTH_URL" "$TEST_BRANCH" >/dev/null 2>&1; then
  git push "$AUTH_URL" --delete "$TEST_BRANCH"
fi

git clone "$AUTH_URL" "$REPO_DIR" >/dev/null
cd "$REPO_DIR"
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
git checkout -b "$TEST_BRANCH" "origin/$DEFAULT_BRANCH" >/dev/null

git config user.email "test@local"
git config user.name "Wile Test"

echo "# Wile OpenCode logs real test" > README.md
mkdir -p .wile/secrets
printf "secrets/\nscreenshots/\nlogs/\n" > .wile/.gitignore
printf "# Wile Progress Log\n\n## Codebase Patterns\n\n---\n" > .wile/progress.txt

cat > .wile/prd.json <<'JSON'
{
  "userStories": [
    {
      "id": "US-LOG-OC-001",
      "title": "Write a small marker file",
      "acceptanceCriteria": [
        "Create integration-log-opencode.txt containing the text REAL OPENCODE LOG TEST"
      ],
      "priority": 1,
      "passes": false
    }
  ]
}
JSON

cat > .wile/additional-instructions.md <<'MD'
- Include the exact line "REAL OPENCODE LOG TEST" in your response output.
MD

git add -A
git commit -m "chore: seed opencode log test" >/dev/null
git push -u origin "$TEST_BRANCH" >/dev/null

mkdir -p "$RUN_DIR/.wile/secrets"
cp "$ENV_TEST" "$RUN_DIR/.wile/secrets/.env"
printf "secrets/\nscreenshots/\nlogs/\n" > "$RUN_DIR/.wile/.gitignore"
cat > "$RUN_DIR/.wile/additional-instructions.md" <<'MD'
- Include the exact line "REAL OPENCODE LOG TEST" in your response output.
MD
cat > "$RUN_DIR/.wile/prd.json" <<'JSON'
{
  "userStories": [
    {
      "id": "US-LOG-OC-RUN",
      "title": "Allow integration run",
      "acceptanceCriteria": ["Run integration"],
      "priority": 1,
      "passes": false
    }
  ]
}
JSON

if grep -q "^CODING_AGENT=" "$RUN_DIR/.wile/secrets/.env"; then
  sed -i '' "s/^CODING_AGENT=.*/CODING_AGENT=OC/" "$RUN_DIR/.wile/secrets/.env"
else
  echo "CODING_AGENT=OC" >> "$RUN_DIR/.wile/secrets/.env"
fi

if grep -q "^OC_PROVIDER=" "$RUN_DIR/.wile/secrets/.env"; then
  sed -i '' "s/^OC_PROVIDER=.*/OC_PROVIDER=native/" "$RUN_DIR/.wile/secrets/.env"
else
  echo "OC_PROVIDER=native" >> "$RUN_DIR/.wile/secrets/.env"
fi

if grep -q "^OC_MODEL=" "$RUN_DIR/.wile/secrets/.env"; then
  sed -i '' "s/^OC_MODEL=.*/OC_MODEL=opencode\/grok-code/" "$RUN_DIR/.wile/secrets/.env"
else
  echo "OC_MODEL=opencode/grok-code" >> "$RUN_DIR/.wile/secrets/.env"
fi

if grep -q "^WILE_REPO_SOURCE=" "$RUN_DIR/.wile/secrets/.env"; then
  sed -i '' "s/^WILE_REPO_SOURCE=.*/WILE_REPO_SOURCE=github/" "$RUN_DIR/.wile/secrets/.env"
else
  echo "WILE_REPO_SOURCE=github" >> "$RUN_DIR/.wile/secrets/.env"
fi

if grep -q "^BRANCH_NAME=" "$RUN_DIR/.wile/secrets/.env"; then
  sed -i '' "s/^BRANCH_NAME=.*/BRANCH_NAME=$TEST_BRANCH/" "$RUN_DIR/.wile/secrets/.env"
else
  echo "BRANCH_NAME=$TEST_BRANCH" >> "$RUN_DIR/.wile/secrets/.env"
fi

export WILE_AGENT_DIR="$ROOT_DIR/packages/agent"
cd "$RUN_DIR"
node "$ROOT_DIR/packages/cli/dist/cli.js" run --max-iterations 1

LOG_FILE=$(ls "$RUN_DIR/.wile/logs"/run-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected run log file" >&2
  exit 1
fi

grep -q "REAL OPENCODE LOG TEST" "$LOG_FILE"

echo "test-opencode-logs-real: ok"
