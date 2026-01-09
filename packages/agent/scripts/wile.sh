#!/bin/bash
#
# Wile - Autonomous AI coding loop
# Pipes prompt to Claude Code repeatedly until all tasks complete
#

set -e

MAX_ITERATIONS=${1:-25}
CLAUDE_MODEL=${CC_CLAUDE_MODEL:-sonnet}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
SETUP_PROMPT_FILE="$SCRIPT_DIR/prompt-setup.md"
ADDITIONAL_PROMPT_FILE="${WILE_ADDITIONAL_INSTRUCTIONS:-}"

echo "══════════════════════════════════════════════════════"
echo "  🌵  WILE - Autonomous Coding Agent"
echo "══════════════════════════════════════════════════════"
echo "  Max iterations: $MAX_ITERATIONS"
echo "  Model:          $CLAUDE_MODEL"
echo "  Prompt file:    $PROMPT_FILE"
echo "══════════════════════════════════════════════════════"
echo ""

if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: Prompt file not found: $PROMPT_FILE"
  exit 1
fi

if [ -n "$ADDITIONAL_PROMPT_FILE" ] && [ -f "$ADDITIONAL_PROMPT_FILE" ]; then
  if [ -s "$ADDITIONAL_PROMPT_FILE" ]; then
    STRIPPED_CONTENT=$(sed '/<!--/,/-->/d' "$ADDITIONAL_PROMPT_FILE" | tr -d '[:space:]')
    if [ -n "$STRIPPED_CONTENT" ]; then
      PROMPT_FILE="/tmp/wile-prompt.md"
      cat "$SCRIPT_DIR/prompt.md" > "$PROMPT_FILE"
      printf "\n\n## Additional Instructions\n\n" >> "$PROMPT_FILE"
      cat "$ADDITIONAL_PROMPT_FILE" >> "$PROMPT_FILE"
    fi
  fi
fi

# ════════════════════════════════════════════════════════════
# ITERATION 0: Setup
# ════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════"
echo "  Iteration 0 - Setup"
echo "══════════════════════════════════════════════════════"
echo ""

if [ -f "$SETUP_PROMPT_FILE" ]; then
  OUTPUT=$(cat "$SETUP_PROMPT_FILE" | claude --model "$CLAUDE_MODEL" --verbose --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true

  # Check if setup failed critically
  if echo "$OUTPUT" | grep -q "<promise>SETUP_FAILED</promise>"; then
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  ❌ SETUP FAILED - Cannot continue"
    echo "══════════════════════════════════════════════════════"
    exit 2
  fi

  echo ""
  echo "Setup complete. Starting main loop..."
  sleep 2
else
  echo "No setup prompt found, skipping iteration 0..."
fi

# ════════════════════════════════════════════════════════════
# ITERATIONS 1-N: Main loop
# ════════════════════════════════════════════════════════════
for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  Iteration $i of $MAX_ITERATIONS"
  echo "══════════════════════════════════════════════════════"
  echo ""

  # Pipe prompt to Claude Code
  # --dangerously-skip-permissions allows autonomous operation
  # Capture output while also displaying it (tee to stderr)
  OUTPUT=$(cat "$PROMPT_FILE" | claude --model "$CLAUDE_MODEL" --verbose --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true

  # Check for completion signal
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  ✅ ALL TASKS COMPLETE"
    echo "══════════════════════════════════════════════════════"
    exit 0
  fi

  echo ""
  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ⚠️  MAX ITERATIONS REACHED ($MAX_ITERATIONS)"
echo "  Some tasks may still be pending."
echo "══════════════════════════════════════════════════════"
exit 1
