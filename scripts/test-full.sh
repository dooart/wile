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

TMP_REPO=$(mktemp -d /tmp/wile-gh-repo-XXXXXX)
TMP_RUN=$(mktemp -d /tmp/wile-gh-run-XXXXXX)

cleanup() {
  if git ls-remote --exit-code --heads "$AUTH_URL" "$TEST_BRANCH" >/dev/null 2>&1; then
    git push "$AUTH_URL" --delete "$TEST_BRANCH" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_REPO" "$TMP_RUN"
}
trap cleanup EXIT INT TERM

if git ls-remote --exit-code --heads "$AUTH_URL" "$TEST_BRANCH" >/dev/null 2>&1; then
  git push "$AUTH_URL" --delete "$TEST_BRANCH"
fi

git clone "$AUTH_URL" "$TMP_REPO"
cd "$TMP_REPO"
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
git checkout -b "$TEST_BRANCH" "origin/$DEFAULT_BRANCH"

mkdir -p .wile
cat > .wile/prd.json <<'JSON'
{
  "userStories": [
    {
      "id": "US-INT-001",
      "title": "Create haiku fixture file",
      "acceptanceCriteria": [
        "Create integration-test/haiku.txt with a three-line haiku"
      ],
      "priority": 1,
      "passes": false
    },
    {
      "id": "US-INT-002",
      "title": "Append signature to haiku fixture",
      "acceptanceCriteria": [
        "Append a blank line and a Signature: Wile line after the haiku"
      ],
      "priority": 2,
      "passes": false
    }
  ]
}
JSON

git add .wile/prd.json
git commit -m "test: setup integration prd"
git push -u origin "$TEST_BRANCH"

cd "$TMP_RUN"
mkdir -p .wile/secrets
cp "$ENV_TEST" .wile/secrets/.env
printf "TEST_FORWARD=ok\n" > .wile/secrets/.env.project
printf "secrets/\nscreenshots/\nlogs/\n" > .wile/.gitignore

cat > .wile/prd.json <<'JSON'
{
  "userStories": [
    {
      "id": "US-INT-LOCAL",
      "title": "Allow integration run",
      "acceptanceCriteria": ["Run integration"],
      "priority": 1,
      "passes": false
    }
  ]
}
JSON

if grep -q "^BRANCH_NAME=" .wile/secrets/.env; then
  sed -i '' "s/^BRANCH_NAME=.*/BRANCH_NAME=$TEST_BRANCH/" .wile/secrets/.env
else
  echo "BRANCH_NAME=$TEST_BRANCH" >> .wile/secrets/.env
fi

if grep -q "^WILE_REPO_SOURCE=" .wile/secrets/.env; then
  sed -i '' "s/^WILE_REPO_SOURCE=.*/WILE_REPO_SOURCE=github/" .wile/secrets/.env
else
  echo "WILE_REPO_SOURCE=github" >> .wile/secrets/.env
fi

cd "$ROOT_DIR"
./scripts/test-local.sh

cd "$TMP_RUN"
export WILE_AGENT_DIR="$ROOT_DIR/packages/agent"
node "$ROOT_DIR/packages/cli/dist/cli.js" run

cd "$TMP_REPO"
git fetch origin "$TEST_BRANCH"
git checkout "$TEST_BRANCH"
git pull --ff-only origin "$TEST_BRANCH"

if [ ! -f integration-test/haiku.txt ]; then
  echo "error: integration-test/haiku.txt not found" >&2
  exit 1
fi

grep -q "Signature: Wile" integration-test/haiku.txt
PASSED_COUNT=$(grep -c "\"passes\": true" .wile/prd.json || true)
if [ "$PASSED_COUNT" -lt 2 ]; then
  echo "error: expected both stories to be marked complete" >&2
  exit 1
fi

echo "test-full: ok"
