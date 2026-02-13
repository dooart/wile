#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"

docker build -t wile-agent:local "$AGENT_DIR" >/dev/null

TMP_DIR=$(mktemp -d /tmp/wile-env-project-XXXXXX)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DIR/.wile/secrets"
cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Env project forward test",
      "description": "Forward custom env file into container",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON

printf "secrets/\nscreenshots/\nlogs/\n" > "$TMP_DIR/.wile/.gitignore"

printf "TEST_FORWARD=ok\n" > "$TMP_DIR/.env.custom"

cat > "$TMP_DIR/.wile/secrets/.env" <<'ENV'
CODING_AGENT=CC
WILE_ENV_PROJECT_PATH=.env.custom
ENV

export WILE_AGENT_DIR="$AGENT_DIR"

cd "$TMP_DIR"
node "$ROOT_DIR/packages/cli/dist/cli.js" run --test --max-iterations 1 >/dev/null 2>&1

LOG_FILE=$(ls "$TMP_DIR/.wile/logs"/run-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected run log file" >&2
  exit 1
fi

grep -q "Forwarded env: ok" "$LOG_FILE"

echo "test-env-project-docker: ok"
