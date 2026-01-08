#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_TEST="$ROOT_DIR/.wile/secrets/.env.test"

if [ ! -f "$ENV_TEST" ]; then
  echo "error: missing $ENV_TEST" >&2
  exit 1
fi

cd "$ROOT_DIR/packages/cli"
bun test
bun run build

TMP_DIR=$(mktemp -d /tmp/wile-local-test-XXXXXX)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DIR/.wile/secrets"
cp "$ENV_TEST" "$TMP_DIR/.wile/secrets/.env"
printf "ENV_FORWARD_TEST=ok\n" > "$TMP_DIR/.wile/secrets/.env.project"
printf "secrets/\nscreenshots/\nlogs/\n" > "$TMP_DIR/.wile/.gitignore"

cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "userStories": [
    {
      "id": "US-TEST-001",
      "title": "Test mode run",
      "acceptanceCriteria": ["Run test mode"],
      "priority": 1,
      "passes": false
    }
  ]
}
JSON

cd "$TMP_DIR"
export WILE_AGENT_DIR="$ROOT_DIR/packages/agent"
node "$ROOT_DIR/packages/cli/dist/cli.js" run --test

LOG_FILE=$(ls "$TMP_DIR/.wile/logs"/run-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected run log file" >&2
  exit 1
fi

grep -q "TEST MODE" "$LOG_FILE"
grep -q "\"passes\": true" "$TMP_DIR/.wile/prd.json"
grep -q "Mocked test mode completion" "$TMP_DIR/.wile/progress.txt"

echo "test-local: ok"
