#!/usr/bin/env bash
set -euo pipefail
if [[ $# -eq 0 ]]; then
  echo 'Usage: with-browser.sh COMMAND [ARGS...] (for example: bun run packages/cli/src/cli.ts run)' >&2
  exit 2
fi
browser_dir=$(cd "$(dirname "$0")" && pwd)
run_id="wile-browser-$$-$(date +%s)"
image="wile-browser:local"
container="${run_id}-chrome"
cleanup() {
  docker stop --time 5 "$container" >/dev/null 2>&1 || true
  docker network rm "$run_id" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Refresh distro browser packages at least daily, even when Docker caches layers.
docker build --pull --build-arg "BROWSER_REFRESH=$(date -u +%Y-%m-%d)" -t "$image" "$browser_dir"
docker network create --label "wile.browser.run=$run_id" "$run_id" >/dev/null
docker run --rm -d --name "$container" --label "wile.browser.run=$run_id" \
  --network "$run_id" --network-alias wile-browser \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --security-opt "seccomp=$browser_dir/seccomp_profile.json" \
  --tmpfs /tmp:rw,nosuid,nodev,size=512m --tmpfs /home/browser:rw,nosuid,nodev,size=32m \
  --shm-size=256m --pids-limit=256 --memory=1g --cpus=2 "$image" >/dev/null
ready=false
for ((attempt=0; attempt<60; attempt++)); do
  status=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)
  if [[ "$status" == 'running healthy' ]]; then ready=true; break; fi
  if [[ "$status" != running* ]]; then break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$container" >&2 || true
  echo 'Isolated browser did not pass version/sandbox preflight. No fallback or sandbox relaxation is permitted.' >&2
  exit 1
fi
WILE_BROWSER_NETWORK="$run_id" AGENT_BROWSER_CDP=http://wile-browser:9222 "$@"
