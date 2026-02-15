#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"
TMP_DIR=$(mktemp -d /tmp/wile-compact-custom-dockerfile-XXXXXX)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DIR/.wile/secrets"
printf "secrets/\nscreenshots/\nlogs/\n" > "$TMP_DIR/.wile/.gitignore"
cp "$ROOT_DIR/scripts/fixtures/compact-prd.json" "$TMP_DIR/.wile/prd.json"
cp "$ROOT_DIR/scripts/fixtures/compact-progress.txt" "$TMP_DIR/.wile/progress.txt"

git -C "$TMP_DIR" init >/dev/null
git -C "$TMP_DIR" config user.email "test@local"
git -C "$TMP_DIR" config user.name "Wile Test"
git -C "$TMP_DIR" add .wile
git -C "$TMP_DIR" commit -m "seed compact custom dockerfile test" >/dev/null

cat > "$TMP_DIR/.wile/secrets/.env" <<'ENV'
CODING_AGENT=CC
CC_ANTHROPIC_API_KEY=dummy-key
CC_CLAUDE_MODEL=sonnet
WILE_REPO_SOURCE=local
WILE_MOCK_CLAUDE=true
ENV

cat > "$TMP_DIR/.wile/Dockerfile" <<'DOCKERFILE'
ARG WILE_BASE_IMAGE=wile-agent:base
FROM ${WILE_BASE_IMAGE}

USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends jq \
  && rm -rf /var/lib/apt/lists/*
USER wile
DOCKERFILE

export WILE_AGENT_DIR="$AGENT_DIR"
cd "$TMP_DIR"
node "$ROOT_DIR/packages/cli/dist/cli.js" compact --max-iterations 1

LOG_FILE=$(ls "$TMP_DIR/.wile/logs"/compact-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected compact log file" >&2
  exit 1
fi

grep -q "WILE - Compact PRD & Progress" "$LOG_FILE"
docker run --rm --entrypoint sh wile-agent:local -lc "command -v jq >/dev/null"

echo "test-compact-custom-dockerfile: ok"
