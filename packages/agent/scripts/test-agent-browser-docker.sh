#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
AGENT_DIR="$ROOT_DIR/packages/agent"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is required for agent-browser test" >&2
  exit 1
fi

docker build -t wile-agent:local "$AGENT_DIR" >/dev/null

OUTPUT_FILE=$(mktemp /tmp/wile-agent-browser-output-XXXXXX)
cleanup() {
  rm -f "$OUTPUT_FILE"
}
trap cleanup EXIT INT TERM

set +e
SESSION_NAME="agent-browser-test"
docker run --rm \
  -e AGENT_BROWSER_SESSION="$SESSION_NAME" \
  --entrypoint /bin/sh \
  wile-agent:local \
  -c "agent-browser open https://example.com >/dev/null && agent-browser get title && agent-browser close" \
  | tee "$OUTPUT_FILE"
EXIT_CODE=$?
set -e

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "error: agent-browser command failed" >&2
  exit 1
fi

if ! grep -q "Example Domain" "$OUTPUT_FILE"; then
  echo "error: agent-browser did not load example.com" >&2
  exit 1
fi

echo "test-agent-browser-docker: ok"
