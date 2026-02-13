#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"

docker build -t wile-agent:local "$AGENT_DIR" >/dev/null

run_case() {
  CASE_NAME="$1"
  EXPECT_SUCCESS="$2"
  EXPECT_PATTERN="$3"

  TMP_DIR=$(mktemp -d "/tmp/wile-prd-${CASE_NAME}-XXXXXX")
  cleanup() {
    rm -rf "$TMP_DIR"
  }
  trap cleanup EXIT INT TERM

  mkdir -p "$TMP_DIR/.wile"
  printf "# Wile Progress Log\n\n## Codebase Patterns\n\n---\n" > "$TMP_DIR/.wile/progress.txt"

  case "$CASE_NAME" in
    missing_prd)
      ;;
    root_only)
      cat > "$TMP_DIR/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Root only",
      "description": "should fail because .wile/prd.json is required",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON
      ;;
    missing_dependency)
      cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Invalid dep",
      "description": "missing dependency",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [99],
      "status": "pending"
    }
  ]
}
JSON
      ;;
    cycle)
      cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Cycle A",
      "description": "depends on B",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [2],
      "status": "pending"
    },
    {
      "id": 2,
      "title": "Cycle B",
      "description": "depends on A",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [1],
      "status": "pending"
    }
  ]
}
JSON
      ;;
    later_dependency_valid)
      cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Can run with later dependency",
      "description": "depends on story 2 which is already done",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [2],
      "status": "pending"
    },
    {
      "id": 2,
      "title": "Done prerequisite",
      "description": "already complete",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "done"
    }
  ]
}
JSON
      ;;
    *)
      echo "error: unknown case $CASE_NAME" >&2
      exit 1
      ;;
  esac

  OUTPUT_FILE="$TMP_DIR/output.txt"

  set +e
  docker run --rm \
    -e CODING_AGENT=CC \
    -e CC_ANTHROPIC_API_KEY=dummy-key \
    -e WILE_REPO_SOURCE=local \
    -e WILE_LOCAL_REPO_PATH=/home/wile/workspace/repo \
    -e MAX_ITERATIONS=2 \
    -e WILE_MOCK_CLAUDE=true \
    -v "$TMP_DIR:/home/wile/workspace/repo" \
    wile-agent:local 2>&1 | tee "$OUTPUT_FILE"
  EXIT_CODE=$?
  set -e

  if [ "$EXPECT_SUCCESS" = "yes" ]; then
    if [ "$EXIT_CODE" -ne 0 ]; then
      echo "error: expected success for case $CASE_NAME" >&2
      exit 1
    fi
  else
    if [ "$EXIT_CODE" -eq 0 ]; then
      echo "error: expected failure for case $CASE_NAME" >&2
      exit 1
    fi
  fi

  grep -q "$EXPECT_PATTERN" "$OUTPUT_FILE"

  rm -rf "$TMP_DIR"
  trap - EXIT INT TERM
}

run_case missing_prd no ".wile/prd.json not found"
run_case root_only no ".wile/prd.json not found"
run_case missing_dependency no "depends on missing story id"
run_case cycle no "Dependency cycle detected"
run_case later_dependency_valid yes "Starting Wile Loop"

echo "test-prd-validation-docker: ok"
