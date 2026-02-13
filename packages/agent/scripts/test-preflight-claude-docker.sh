#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"

if [ -z "${CC_CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -z "${CC_ANTHROPIC_API_KEY:-}" ]; then
  echo "error: CC_CLAUDE_CODE_OAUTH_TOKEN or CC_ANTHROPIC_API_KEY is required" >&2
  exit 1
fi

docker build -t wile-agent:local "$AGENT_DIR" >/dev/null

TMP_DIR=$(mktemp -d /tmp/wile-preflight-claude-XXXXXX)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DIR/.wile"
cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Preflight fail test (claude)",
      "description": "Preflight failure harness",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON

cat > "$TMP_DIR/.wile/preflight.md" <<'MD'
- Verify the file exists:

```bash
test -f /proc/this-file-should-not-exist
```
MD

OUTPUT_FILE="$TMP_DIR/output.txt"

set +e
docker run --rm \
  -e CODING_AGENT=CC \
  -e CC_CLAUDE_MODEL=haiku \
  -e CC_CLAUDE_CODE_OAUTH_TOKEN="${CC_CLAUDE_CODE_OAUTH_TOKEN:-}" \
  -e CC_ANTHROPIC_API_KEY="${CC_ANTHROPIC_API_KEY:-}" \
  -e WILE_REPO_SOURCE=local \
  -e WILE_LOCAL_REPO_PATH=/home/wile/workspace/repo \
  -e MAX_ITERATIONS=1 \
  -v "$TMP_DIR:/home/wile/workspace/repo" \
  wile-agent:local 2>&1 | tee "$OUTPUT_FILE"
EXIT_CODE=$?
set -e

fail() {
  local message="$1"
  echo "error: $message" >&2
  if [ -f "$OUTPUT_FILE" ]; then
    echo "output (tail):" >&2
    tail -n 80 "$OUTPUT_FILE" >&2
  fi
  exit 1
}

if [ "$EXIT_CODE" -eq 0 ]; then
  fail "expected non-zero exit code for preflight failure"
fi

grep -q "Model:          haiku" "$OUTPUT_FILE" || fail "expected haiku model in output"
grep -q "PREFLIGHT FAILED - Cannot continue" "$OUTPUT_FILE" || fail "missing preflight failure banner"
grep -q "^<promise>PREFLIGHT_FAILED</promise>$" "$OUTPUT_FILE" || fail "missing preflight failed promise line"
grep -q "/proc/this-file-should-not-exist" "$OUTPUT_FILE" || fail "missing preflight check command in output"
if grep -q "PREFLIGHT_SUCCEEDED" "$OUTPUT_FILE"; then
  fail "preflight should not succeed in claude failure test"
fi
if grep -q "Iteration 1 of" "$OUTPUT_FILE"; then
  fail "preflight failure should stop before main loop"
fi
if [ ! -f "$TMP_DIR/.wile/progress.txt" ]; then
  fail "expected progress log to be written on preflight failure"
fi
grep -q "PREFLIGHT FAILED" "$TMP_DIR/.wile/progress.txt" || fail "progress log missing failure entry"
grep -q "/proc/this-file-should-not-exist" "$TMP_DIR/.wile/progress.txt" || fail "progress log missing failed check detail"

echo "test-preflight-claude-docker: ok"
