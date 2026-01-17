#!/bin/bash
#
# Wile - Preflight check (single run)
#

set -e

CODING_AGENT=${CODING_AGENT:-CC}
CLAUDE_MODEL=${CC_CLAUDE_MODEL:-sonnet}
OC_PROVIDER=${OC_PROVIDER:-native}
OC_MODEL=${OC_MODEL:-opencode/grok-code}
GEMINI_MODEL=${GEMINI_MODEL:-auto-gemini-3}

# For openrouter provider, prepend vendor prefix if missing
if [ "$OC_PROVIDER" = "openrouter" ] && [[ "$OC_MODEL" != */* ]]; then
  OC_MODEL="z-ai/$OC_MODEL"
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFLIGHT_PROMPT_FILE="$SCRIPT_DIR/prompt-preflight.md"
PROGRESS_PATH="${WILE_PROGRESS_PATH:-.wile/progress.txt}"
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
elif [ "$CODING_AGENT" = "GC" ]; then
  echo "  Model:          ${GEMINI_MODEL:-auto}"
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

run_gemini() {
  local prompt_path="$1"
  local prompt_text
  prompt_text=$(cat "$prompt_path")
  local model_args=()
  if [ -n "$GEMINI_MODEL" ]; then
    model_args=(--model "$GEMINI_MODEL")
  fi
  gemini --output-format stream-json --yolo "${model_args[@]}" "$prompt_text" \
    | node "$SCRIPT_DIR/gemini-stream.js"
}

run_agent() {
  local prompt_path="$1"
  if [ "$CODING_AGENT" = "OC" ]; then
    run_opencode "$prompt_path"
  elif [ "$CODING_AGENT" = "GC" ]; then
    run_gemini "$prompt_path"
  else
    run_claude "$prompt_path"
  fi
}

has_terminal_promise() {
  local output="$1"
  local marker="$2"
  local clean_output normalized_output marker_re

  clean_output=$(printf '%s' "$output" | tr -d '\r')
  normalized_output=$(printf '%s' "$clean_output" | tr '\n' ' ' | sed -e 's/[[:space:]]*$//')
  marker_re=${marker//_/[[:space:]]*_[[:space:]]*}

  printf '%s' "$normalized_output" | grep -q -E "<[[:space:]]*promise>[[:space:]]*${marker_re}[[:space:]]*</[[:space:]]*promise>[[:space:]]*$"
}

OUTPUT=$(run_agent "$PREFLIGHT_PROMPT_FILE" | tee "$TEE_TARGET") || true
CLEAN_OUTPUT=$(printf '%s' "$OUTPUT" | tr -d '\r')
if has_terminal_promise "$OUTPUT" "PREFLIGHT_FAILED"; then
  if printf '%s' "$CLEAN_OUTPUT" | grep -F '```' >/dev/null 2>&1; then
    :
  elif printf '%s' "$CLEAN_OUTPUT" | grep -F '`<promise>PREFLIGHT_FAILED</promise>`' >/dev/null 2>&1; then
    :
  else
  if [ -f "$PROGRESS_PATH" ]; then
    TAIL_LINES="${PREFLIGHT_LOG_TAIL:-80}"
    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  Preflight log tail (${TAIL_LINES} lines)"
    echo "══════════════════════════════════════════════════════"
    tail -n "$TAIL_LINES" "$PROGRESS_PATH" || true
  fi
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
