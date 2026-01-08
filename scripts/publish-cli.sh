#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
CLI_DIR="$ROOT_DIR/packages/cli"

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <patch|minor|major>" >&2
  exit 1
fi

case "$1" in
  patch|minor|major) ;;
  *)
    echo "error: version bump must be patch, minor, or major" >&2
    exit 1
    ;;
esac

if ! git -C "$ROOT_DIR" diff --quiet || ! git -C "$ROOT_DIR" diff --staged --quiet; then
  echo "error: git working tree is not clean; commit or stash changes first" >&2
  exit 1
fi

cd "$CLI_DIR"

if ! npm whoami >/dev/null 2>&1; then
  echo "ERROR: npm is not authenticated. Run 'npm login' in packages/cli first." >&2
  exit 1
fi

./scripts/release.sh "$1"

VERSION=$(node -p "require('./package.json').version")

echo "Publish complete: v$VERSION"
