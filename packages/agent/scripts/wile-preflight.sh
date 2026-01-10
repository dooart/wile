#!/bin/bash
#
# Wile - Preflight check (single run)
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
PREFLIGHT_PROMPT_FILE="$SCRIPT_DIR/prompt-preflight.md"
TEE_TARGET="${WILE_TEE_TARGET:-/dev/stderr}"
if ! ( : > "$TEE_TARGET" ) 2>/dev/null; then
  TEE_TARGET="/dev/null"
fi

echo "══════════════════════════════════════════════════════"
echo "  🌵  WILE - Preflight"
echo "══════════════════════════════════════════════════════"
echo "  Agent:          $CODING_AGENT"
if [ "$CODING_AGENT" = "OC" ]; then
  echo "  Provider:       $OC_PROVIDER"
  echo "  Model:          $OC_MODEL"
else
  echo "  Model:          $CLAUDE_MODEL"
fi
echo "  Prompt file:    $PREFLIGHT_PROMPT_FILE"
echo "══════════════════════════════════════════════════════"
echo ""

if [ ! -f "$PREFLIGHT_PROMPT_FILE" ]; then
  echo "ERROR: Preflight prompt file not found: $PREFLIGHT_PROMPT_FILE"
  exit 1
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

OUTPUT=$(run_agent "$PREFLIGHT_PROMPT_FILE" | tee "$TEE_TARGET") || true
CLEAN_OUTPUT=$(printf '%s' "$OUTPUT" | tr -d '\r' | sed -e 's/[[:space:]]*$//')
if printf '%s\n' "$CLEAN_OUTPUT" | grep -q -E '^[[:space:]]*<promise>PREFLIGHT_FAILED</promise>[[:space:]]*$'; then
  if printf '%s' "$CLEAN_OUTPUT" | grep -F '```' >/dev/null 2>&1; then
    :
  elif printf '%s' "$CLEAN_OUTPUT" | grep -F '`<promise>PREFLIGHT_FAILED</promise>`' >/dev/null 2>&1; then
    :
  else
  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  ❌ PREFLIGHT FAILED"
  echo "══════════════════════════════════════════════════════"
  exit 2
  fi
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ PREFLIGHT COMPLETE"
echo "══════════════════════════════════════════════════════"
