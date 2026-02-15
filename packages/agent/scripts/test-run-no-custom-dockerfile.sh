#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"
TMP_DIR=$(mktemp -d /tmp/wile-run-no-custom-XXXXXX)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DIR/.wile/secrets"
printf "secrets/\nscreenshots/\nlogs/\n" > "$TMP_DIR/.wile/.gitignore"

cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Default dockerfile fallback test",
      "description": "Ensure run still works without .wile/Dockerfile",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON

cat > "$TMP_DIR/.wile/secrets/.env" <<'ENV'
CODING_AGENT=CC
ENV

if [ -f "$TMP_DIR/.wile/Dockerfile" ]; then
  echo "error: .wile/Dockerfile should not exist for fallback test" >&2
  exit 1
fi

export WILE_AGENT_DIR="$AGENT_DIR"
cd "$TMP_DIR"
OUTPUT_FILE="$TMP_DIR/output.txt"
node "$ROOT_DIR/packages/cli/dist/cli.js" run --test --max-iterations 1 --debug 2>&1 | tee "$OUTPUT_FILE"

grep -q "customDockerfile: (unset)" "$OUTPUT_FILE"

LOG_FILE=$(ls "$TMP_DIR/.wile/logs"/run-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected run log file" >&2
  exit 1
fi

grep -q "TEST MODE" "$LOG_FILE"
grep -q "\"status\": \"done\"" "$TMP_DIR/.wile/prd.json"

echo "test-run-no-custom-dockerfile: ok"
