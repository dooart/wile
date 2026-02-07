#!/bin/sh
set -euo pipefail

run_case() {
  LABEL="$1"
  MODE="$2"
  EXPECT_HEADER="$3"

  TMP_DIR=$(mktemp -d /tmp/wile-additional-test-XXXXXX)
  cleanup() {
    rm -rf "$TMP_DIR"
  }
  trap cleanup EXIT INT TERM

  SCRIPT_DIR="$TMP_DIR/agent"
  BIN_DIR="$TMP_DIR/bin"
  mkdir -p "$SCRIPT_DIR" "$BIN_DIR"

  REPO_SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
  cp "$REPO_SCRIPTS/wile.sh" "$SCRIPT_DIR/wile.sh"
  cp "$REPO_SCRIPTS/claude-stream.js" "$SCRIPT_DIR/claude-stream.js"
  chmod +x "$SCRIPT_DIR/wile.sh"

  echo "BASE PROMPT" > "$SCRIPT_DIR/prompt.md"

  ADDITIONAL="$TMP_DIR/additional.md"
  if [ "$MODE" = "comment-only" ]; then
    cat > "$ADDITIONAL" <<'EOF'
<!--
Use bullet points for additional instructions, e.g.
- You may run `supabase db reset --db-url "$SUPABASE_DB_URL"` when needed.
- Do not ask for permission before running it.
-->
EOF
  else
    cat > "$ADDITIONAL" <<'EOF'
<!--
Use bullet points for additional instructions, e.g.
- You may run `supabase db reset --db-url "$SUPABASE_DB_URL"` when needed.
- Do not ask for permission before running it.
-->
- Always reset the database before integration tests.
EOF
  fi

  CAPTURE="$TMP_DIR/capture.txt"

cat > "$BIN_DIR/claude" <<'EOF'
#!/bin/sh
cat > "$CLAUDE_CAPTURE"
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"text","text":"<promise>ALL_STORIES_COMPLETED</promise>\n"}]}}'
EOF
  chmod +x "$BIN_DIR/claude"

  PATH="$BIN_DIR:$PATH" \
  CLAUDE_CAPTURE="$CAPTURE" \
  WILE_ADDITIONAL_INSTRUCTIONS="$ADDITIONAL" \
  CC_CLAUDE_MODEL="sonnet" \
  "$SCRIPT_DIR/wile.sh" 1 >/dev/null 2>&1

  if ! grep -q "BASE PROMPT" "$CAPTURE"; then
    echo "error: base prompt missing in $LABEL" >&2
    exit 1
  fi

  if [ "$EXPECT_HEADER" = "yes" ]; then
    grep -q "## Additional Instructions" "$CAPTURE"
    grep -q "Always reset the database before integration tests." "$CAPTURE"
  else
    if grep -q "## Additional Instructions" "$CAPTURE"; then
      echo "error: header appended unexpectedly in $LABEL" >&2
      exit 1
    fi
  fi

  rm -rf "$TMP_DIR"
  trap - EXIT INT TERM
}

run_case "comment-only" "comment-only" "no"

run_case "with-content" "with-content" "yes"

echo "test-additional-instructions: ok"
