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

npm version "$1" --no-git-tag-version
VERSION=$(node -p "require('./package.json').version")

git -C "$ROOT_DIR" add "$CLI_DIR/package.json" "$CLI_DIR/package-lock.json" 2>/dev/null || true
git -C "$ROOT_DIR" commit -m "release v$VERSION"

bun run build
chmod +x dist/cli.js

node -e "const fs=require('fs');const data=fs.readFileSync('dist/cli.js','utf8');if(!data.startsWith('#!/usr/bin/env node')){console.error('missing shebang');process.exit(1);}"

echo "prepared v$VERSION"
