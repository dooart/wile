#!/bin/sh
set -euo pipefail

TMP_DIR=$(mktemp -d /tmp/wile-iteration-limit-XXXXXX)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

SCRIPT_DIR="$TMP_DIR/agent"
BIN_DIR="$TMP_DIR/bin"
mkdir -p "$SCRIPT_DIR" "$BIN_DIR"

REPO_SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
cp "$REPO_SCRIPTS/wile.sh" "$SCRIPT_DIR/wile.sh"
cp "$REPO_SCRIPTS/claude-stream.ts" "$SCRIPT_DIR/claude-stream.ts"
chmod +x "$SCRIPT_DIR/wile.sh"

echo "BASE PROMPT" > "$SCRIPT_DIR/prompt.md"

OUTPUT_FILE="$TMP_DIR/output.txt"

cat > "$BIN_DIR/claude" <<'EOF'
#!/bin/sh
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"text","text":"working...\n"}]}}'
EOF
chmod +x "$BIN_DIR/claude"

set +e
PATH="$BIN_DIR:$PATH" \
CODING_AGENT="CC" \
CC_CLAUDE_MODEL="sonnet" \
"$SCRIPT_DIR/wile.sh" 3 > "$OUTPUT_FILE" 2>&1
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -eq 0 ]; then
  echo "error: expected non-zero exit when max iterations reached" >&2
  exit 1
fi

grep -q "MAX ITERATIONS REACHED (3)" "$OUTPUT_FILE"
grep -q "Iteration 1 of 3" "$OUTPUT_FILE"
grep -q "Iteration 3 of 3" "$OUTPUT_FILE"

echo "test-iteration-limit: ok"
