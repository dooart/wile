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

TMP_ROOT=$(mktemp -d /tmp/wile-compact-XXXXXX)
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

mkdir -p .wile/secrets
printf "secrets/\nscreenshots/\nlogs/\n" > .wile/.gitignore
cp "$ROOT_DIR/scripts/fixtures/compact-prd.json" .wile/prd.json
cp "$ROOT_DIR/scripts/fixtures/compact-progress.txt" .wile/progress.txt

git add -A
git commit -m "chore: seed compact integration test" >/dev/null
git push -u origin "$TEST_BRANCH" >/dev/null

mkdir -p "$RUN_DIR/.wile/secrets"
cp "$ENV_TEST" "$RUN_DIR/.wile/secrets/.env"
printf "secrets/\nscreenshots/\nlogs/\n" > "$RUN_DIR/.wile/.gitignore"

cp "$ROOT_DIR/scripts/fixtures/compact-prd.json" "$RUN_DIR/.wile/prd.json"
cp "$ROOT_DIR/scripts/fixtures/compact-progress.txt" "$RUN_DIR/.wile/progress.txt"

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
  sed -i '' "s/^OC_MODEL=.*/OC_MODEL=opencode\\/grok-code/" "$RUN_DIR/.wile/secrets/.env"
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

cd "$ROOT_DIR/packages/cli"
./build.sh >/dev/null 2>&1
cd "$RUN_DIR"

echo "---- BEFORE: .wile/prd.json ----"
cat "$RUN_DIR/.wile/prd.json"
echo "---- BEFORE: .wile/progress.txt ----"
cat "$RUN_DIR/.wile/progress.txt"

node "$ROOT_DIR/packages/cli/dist/cli.js" compact --max-iterations 1

LOG_FILE=$(ls "$RUN_DIR/.wile/logs"/compact-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected compact log file" >&2
  exit 1
fi

grep -q "WILE - Compact PRD & Progress" "$LOG_FILE"

cd "$REPO_DIR"
git fetch origin "$TEST_BRANCH" >/dev/null
git checkout "$TEST_BRANCH" >/dev/null
git reset --hard "origin/$TEST_BRANCH" >/dev/null

echo "---- AFTER: .wile/prd.json (repo) ----"
cat .wile/prd.json
echo "---- AFTER: .wile/progress.txt (repo) ----"
cat .wile/progress.txt

bun "$ROOT_DIR/packages/agent/scripts/validate-prd.ts" --path .wile/prd.json >/dev/null
grep -q '"id": 4' .wile/prd.json
grep -q '"id": 5' .wile/prd.json
grep -q '"status": "pending"' .wile/prd.json

echo "test-compact: ok"
