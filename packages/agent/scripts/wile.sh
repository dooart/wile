#!/bin/bash
#
# Wile - Autonomous AI coding loop
# Pipes prompt to Claude Code repeatedly until all tasks complete
#

set -e

MAX_ITERATIONS=${1:-25}
CODING_AGENT=${CODING_AGENT:-CC}
CLAUDE_MODEL=${CC_CLAUDE_MODEL:-sonnet}
OC_PROVIDER=${OC_PROVIDER:-native}
OC_MODEL=${OC_MODEL:-opencode/grok-code}

# For openrouter provider, prepend vendor prefix if missing
if [ "$OC_PROVIDER" = "openrouter" ] && [[ "$OC_MODEL" != */* ]]; then
  OC_MODEL="z-ai/$OC_MODEL"
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
PREFLIGHT_PROMPT_FILE="$SCRIPT_DIR/prompt-preflight.md"
ADDITIONAL_PROMPT_FILE="${WILE_ADDITIONAL_INSTRUCTIONS:-}"
TEE_TARGET="${WILE_TEE_TARGET:-/dev/stderr}"
if ! ( : > "$TEE_TARGET" ) 2>/dev/null; then
  TEE_TARGET="/dev/null"
fi

echo "══════════════════════════════════════════════════════"
echo "  🌵  WILE - Autonomous Coding Agent"
echo "══════════════════════════════════════════════════════"
echo "  Agent:          $CODING_AGENT"
echo "  Max iterations: $MAX_ITERATIONS"
if [ "$CODING_AGENT" = "OC" ]; then
  echo "  Provider:       $OC_PROVIDER"
  echo "  Model:          $OC_MODEL"
else
  echo "  Model:          $CLAUDE_MODEL"
fi
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

run_claude() {
  local prompt_path="$1"
  cat "$prompt_path" \
    | claude --model "$CLAUDE_MODEL" --print --output-format stream-json --verbose --dangerously-skip-permissions \
    | node "$SCRIPT_DIR/claude-stream.js"
}

run_opencode() {
  local prompt_path="$1"
  local model_arg="$OC_MODEL"
  if [ "$OC_PROVIDER" = "openrouter" ]; then
    model_arg="openrouter/$OC_MODEL"
  fi
  cat "$prompt_path" \
    | opencode run --format json --model "$model_arg" \
    | node "$SCRIPT_DIR/opencode-stream.js"
}

run_agent() {
  local prompt_path="$1"
  if [ "$CODING_AGENT" = "OC" ]; then
    run_opencode "$prompt_path"
  else
    run_claude "$prompt_path"
  fi
}

# ════════════════════════════════════════════════════════════
# ITERATION 0: Preflight / Setup
# ════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════"
echo "  Iteration 0 - Preflight"
echo "══════════════════════════════════════════════════════"
echo ""

if [ -f "$PREFLIGHT_PROMPT_FILE" ]; then
  OUTPUT=$(run_agent "$PREFLIGHT_PROMPT_FILE" | tee "$TEE_TARGET") || true

  # Check if preflight failed critically (tag must be on its own line; reject backticks/code fences)
  CLEAN_OUTPUT=$(printf '%s' "$OUTPUT" | tr -d '\r' | sed -e 's/[[:space:]]*$//')
  if printf '%s\n' "$CLEAN_OUTPUT" | grep -q -E '^[[:space:]]*<promise>PREFLIGHT_FAILED</promise>[[:space:]]*$'; then
    if printf '%s' "$CLEAN_OUTPUT" | grep -F '```' >/dev/null 2>&1; then
      :
    elif printf '%s' "$CLEAN_OUTPUT" | grep -F '`<promise>PREFLIGHT_FAILED</promise>`' >/dev/null 2>&1; then
      :
    else
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  ❌ PREFLIGHT FAILED - Cannot continue"
    echo "══════════════════════════════════════════════════════"
    exit 2
    fi
  fi

  echo ""
  echo "Preflight complete. Starting main loop..."
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
  OUTPUT=$(run_agent "$PROMPT_FILE" | tee "$TEE_TARGET") || true

  # Check for completion signal (tag must be the final non-empty line)
  CLEAN_OUTPUT=$(printf '%s' "$OUTPUT" | tr -d '\r' | sed -e 's/[[:space:]]*$//')
  FINAL_LINE=$(printf '%s\n' "$CLEAN_OUTPUT" | awk 'NF { last=$0 } END { print last }')
  if printf '%s\n' "$FINAL_LINE" | grep -q -E '^[[:space:]]*<promise>ALL_STORIES_COMPLETED</promise>[[:space:]]*$'; then
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
