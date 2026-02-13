#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"

docker build -t wile-agent:local "$AGENT_DIR" >/dev/null

run_failure_case() {
  local mock_mode="${1:-preflight_fail}"
  TMP_DIR=$(mktemp -d /tmp/wile-preflight-fail-XXXXXX)
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
      "title": "Preflight fail test",
      "description": "Preflight failure harness",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON

  cat > "$TMP_DIR/.wile/progress.txt" <<'TXT'
# Wile Progress Log

## Codebase Patterns

---
TXT

  cat > "$TMP_DIR/.wile/preflight.md" <<'MD'
<!--
Use bullet points for preflight checks, e.g.
- Confirm SUPABASE_DB_URL is set.
- Run `supabase db reset --db-url "$SUPABASE_DB_URL"`.
-->
MD

  OUTPUT_FILE="$TMP_DIR/output.txt"

  set +e
  docker run --rm \
    -e CODING_AGENT=CC \
    -e CC_ANTHROPIC_API_KEY=dummy-key \
    -e WILE_REPO_SOURCE=local \
    -e WILE_LOCAL_REPO_PATH=/home/wile/workspace/repo \
    -e MAX_ITERATIONS=1 \
    -e WILE_MOCK_CLAUDE=true \
    -e WILE_MOCK_MODE="$mock_mode" \
    -v "$TMP_DIR:/home/wile/workspace/repo" \
    wile-agent:local 2>&1 | tee "$OUTPUT_FILE"
  EXIT_CODE=$?
  set -e

  if [ "$EXIT_CODE" -eq 0 ]; then
    echo "error: expected non-zero exit code for preflight failure" >&2
    exit 1
  fi

  grep -q "PREFLIGHT FAILED - Cannot continue" "$OUTPUT_FILE"
  if grep -q "Iteration 1 of" "$OUTPUT_FILE"; then
    echo "error: preflight failure should stop before main loop" >&2
    exit 1
  fi
  grep -q "PREFLIGHT FAILED" "$TMP_DIR/.wile/progress.txt"

  rm -rf "$TMP_DIR"
  trap - EXIT INT TERM
}

run_trailing_case() {
  TMP_DIR=$(mktemp -d /tmp/wile-preflight-trailing-XXXXXX)
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
      "title": "Preflight trailing marker test",
      "description": "Preflight trailing marker harness",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON

  cat > "$TMP_DIR/.wile/preflight.md" <<'MD'
<!--
Use bullet points for preflight checks, e.g.
- Confirm SUPABASE_DB_URL is set.
- Run `supabase db reset --db-url "$SUPABASE_DB_URL"`.
-->
MD

  OUTPUT_FILE="$TMP_DIR/output.txt"

  set +e
  docker run --rm \
    -e CODING_AGENT=CC \
    -e CC_ANTHROPIC_API_KEY=dummy-key \
    -e WILE_REPO_SOURCE=local \
    -e WILE_LOCAL_REPO_PATH=/home/wile/workspace/repo \
    -e MAX_ITERATIONS=1 \
    -e WILE_MOCK_CLAUDE=true \
    -e WILE_MOCK_MODE=preflight_fail_trailing \
    -v "$TMP_DIR:/home/wile/workspace/repo" \
    wile-agent:local 2>&1 | tee "$OUTPUT_FILE"
  EXIT_CODE=$?
  set -e

  if [ "$EXIT_CODE" -ne 0 ]; then
    echo "error: expected zero exit code for trailing marker case" >&2
    exit 1
  fi

  grep -q "Preflight complete. Starting main loop..." "$OUTPUT_FILE"
  grep -q "✅ ALL TASKS COMPLETE" "$OUTPUT_FILE"

  rm -rf "$TMP_DIR"
  trap - EXIT INT TERM
}

run_success_case() {
  TMP_DIR=$(mktemp -d /tmp/wile-preflight-success-XXXXXX)
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
      "title": "Preflight success test",
      "description": "Preflight success harness",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON

  cat > "$TMP_DIR/.wile/preflight.md" <<'MD'
<!--
Use bullet points for preflight checks, e.g.
- Confirm SUPABASE_DB_URL is set.
- Run `supabase db reset --db-url "$SUPABASE_DB_URL"`.
-->
MD

  OUTPUT_FILE="$TMP_DIR/output.txt"

  set +e
  docker run --rm \
    -e CODING_AGENT=CC \
    -e CC_ANTHROPIC_API_KEY=dummy-key \
    -e WILE_REPO_SOURCE=local \
    -e WILE_LOCAL_REPO_PATH=/home/wile/workspace/repo \
    -e MAX_ITERATIONS=1 \
    -e WILE_MOCK_CLAUDE=true \
    -v "$TMP_DIR:/home/wile/workspace/repo" \
    wile-agent:local 2>&1 | tee "$OUTPUT_FILE"
  EXIT_CODE=$?
  set -e

  if [ "$EXIT_CODE" -ne 0 ]; then
    echo "error: expected zero exit code for preflight success" >&2
    exit 1
  fi

  grep -q "Preflight complete. Starting main loop..." "$OUTPUT_FILE"

  rm -rf "$TMP_DIR"
  trap - EXIT INT TERM
}

run_failure_case
run_failure_case preflight_fail_split
run_trailing_case
run_success_case

echo "test-preflight-docker: ok"
