#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"
TMP_DIR=$(mktemp -d /tmp/wile-custom-dockerfile-XXXXXX)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

mkdir -p "$TMP_DIR/.wile/secrets"
printf "secrets/\nscreenshots/\nlogs/\n" > "$TMP_DIR/.wile/.gitignore"

cat > "$TMP_DIR/.wile/prd.json" <<'JSON'
{
  "stories": [
    {
      "id": 1,
      "title": "Custom dockerfile test",
      "description": "Verify project Dockerfile extends Wile base image.",
      "acceptanceCriteria": ["n/a"],
      "dependsOn": [],
      "status": "pending"
    }
  ]
}
JSON

cat > "$TMP_DIR/.wile/secrets/.env" <<'ENV'
CODING_AGENT=CC
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
node "$ROOT_DIR/packages/cli/dist/cli.js" run --test --max-iterations 1

LOG_FILE=$(ls "$TMP_DIR/.wile/logs"/run-*.log | head -n 1)
if [ -z "$LOG_FILE" ]; then
  echo "error: expected run log file" >&2
  exit 1
fi

grep -q "TEST MODE" "$LOG_FILE"
docker run --rm --entrypoint sh wile-agent:local -lc "command -v jq >/dev/null"

echo "test-custom-dockerfile: ok"
