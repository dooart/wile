#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
ENV_TEST="$ROOT_DIR/.wile/secrets/.env.test"

if [ ! -f "$ENV_TEST" ]; then
  echo "error: missing $ENV_TEST" >&2
  exit 1
fi

set -a
. "$ENV_TEST"
set +a

sh "$ROOT_DIR/packages/agent/scripts/test-preflight-claude-docker.sh"
