#!/bin/bash
#
# Wile - Compact PRD/Progress
#

set -e

CODING_AGENT=${CODING_AGENT:-CC}
CLAUDE_MODEL=${CC_CLAUDE_MODEL:-sonnet}
OC_PROVIDER=${OC_PROVIDER:-native}
OC_MODEL=${OC_MODEL:-opencode/grok-code}

# For openrouter provider, prepend vendor prefix if missing
if [ "$OC_PROVIDER" = "openrouter" ] && [[ "$OC_MODEL" != */* ]]; then
  OC_MODEL="z-ai/$OC_MODEL"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SCRIPT_DIR/prompt-compact.md"
ADDITIONAL_PROMPT_FILE="${WILE_ADDITIONAL_INSTRUCTIONS:-}"
TEE_TARGET="${WILE_TEE_TARGET:-/dev/stderr}"
if ! ( : > "$TEE_TARGET" ) 2>/dev/null; then
  TEE_TARGET="/dev/null"
fi

echo "══════════════════════════════════════════════════════"
echo "  🌵  WILE - Compact PRD & Progress"
echo "══════════════════════════════════════════════════════"
echo "  Agent:          $CODING_AGENT"
if [ "$CODING_AGENT" = "OC" ]; then
  echo "  Provider:       $OC_PROVIDER"
  echo "  Model:          $OC_MODEL"
else
  echo "  Model:          $CLAUDE_MODEL"
fi
echo "  Prompt file:    $PROMPT_FILE"
echo "══════════════════════════════════════════════════════"
echo ""

if [ -n "$ADDITIONAL_PROMPT_FILE" ] && [ -f "$ADDITIONAL_PROMPT_FILE" ]; then
  if [ -s "$ADDITIONAL_PROMPT_FILE" ]; then
    STRIPPED_CONTENT=$(sed '/<!--/,/-->/d' "$ADDITIONAL_PROMPT_FILE" | tr -d '[:space:]')
    if [ -n "$STRIPPED_CONTENT" ]; then
      PROMPT_FILE="/tmp/wile-prompt-compact.md"
      cat "$SCRIPT_DIR/prompt-compact.md" > "$PROMPT_FILE"
      printf "\n\n## Additional Instructions\n\n" >> "$PROMPT_FILE"
      cat "$ADDITIONAL_PROMPT_FILE" >> "$PROMPT_FILE"
      echo "  Extra:          Using additional instructions"
      echo "  Prompt file:    $PROMPT_FILE"
      echo ""
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

# Snapshot original PRD for validation of passes:false preservation.
if [ -f ".wile/prd.json" ]; then
  cp ".wile/prd.json" ".wile/prd.json.original"
fi

echo "Running compact agent..."
OUTPUT=$(run_agent "$PROMPT_FILE" | tee "$TEE_TARGET") || true

# Validate the resulting files instead of the response format.
node "$SCRIPT_DIR/validate-compact.js"

if [ -f ".wile/prd.json.original" ]; then
  rm -f ".wile/prd.json.original"
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ COMPACT COMPLETE"
echo "══════════════════════════════════════════════════════"
