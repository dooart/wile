#!/bin/bash
#
# Wile - Compact PRD/Progress
#

set -e

CODING_AGENT=${CODING_AGENT:-CC}
CLAUDE_MODEL=${CC_CLAUDE_MODEL:-sonnet}
OC_PROVIDER=${OC_PROVIDER:-native}
OC_MODEL=${OC_MODEL:-opencode/grok-code}
GEMINI_MODEL=${GEMINI_MODEL:-auto-gemini-3}
CODEX_MODEL=${CODEX_MODEL:-}

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
elif [ "$CODING_AGENT" = "GC" ]; then
  echo "  Model:          ${GEMINI_MODEL:-auto}"
elif [ "$CODING_AGENT" = "CX" ]; then
  echo "  Model:          ${CODEX_MODEL:-default}"
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
    | bun "$SCRIPT_DIR/claude-stream.ts"
}

run_opencode() {
  local prompt_path="$1"
  local model_arg="$OC_MODEL"
  if [ "$OC_PROVIDER" = "openrouter" ]; then
    model_arg="openrouter/$OC_MODEL"
  fi
  cat "$prompt_path" \
    | opencode run --format json --model "$model_arg" \
    | bun "$SCRIPT_DIR/opencode-stream.ts"
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
    | bun "$SCRIPT_DIR/gemini-stream.ts"
}

run_codex() {
  local prompt_path="$1"
  local model_args=()
  if [ -n "$CODEX_MODEL" ]; then
    model_args=(--model "$CODEX_MODEL")
  fi
  cat "$prompt_path" \
    | codex exec --json --dangerously-bypass-approvals-and-sandbox "${model_args[@]}" - \
    | bun "$SCRIPT_DIR/codex-stream.ts"
}

run_agent() {
  local prompt_path="$1"
  if [ "$CODING_AGENT" = "OC" ]; then
    run_opencode "$prompt_path"
  elif [ "$CODING_AGENT" = "GC" ]; then
    run_gemini "$prompt_path"
  elif [ "$CODING_AGENT" = "CX" ]; then
    run_codex "$prompt_path"
  else
    run_claude "$prompt_path"
  fi
}

# Snapshot original PRD for validation of pending-story preservation.
if [ -f ".wile/prd.json" ]; then
  cp ".wile/prd.json" ".wile/prd.json.original"
fi

echo "Running compact agent..."
OUTPUT=$(run_agent "$PROMPT_FILE" | tee "$TEE_TARGET") || true

# Validate the resulting files instead of the response format.
bun "$SCRIPT_DIR/validate-compact.ts"

if [ -f ".wile/prd.json.original" ]; then
  rm -f ".wile/prd.json.original"
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  ✅ COMPACT COMPLETE"
echo "══════════════════════════════════════════════════════"
