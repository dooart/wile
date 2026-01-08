#!/bin/sh
set -e

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <patch|minor|major>"
  exit 1
fi

case "$1" in
  patch|minor|major) ;;
  *)
    echo "error: version bump must be patch, minor, or major"
    exit 1
    ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel)"
CLI_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --staged --quiet; then
  echo "error: git working tree is not clean; commit or stash changes first"
  exit 1
fi

cd "$CLI_DIR"

if ! npm whoami >/dev/null 2>&1; then
  echo "error: npm is not authenticated. run 'npm login' in packages/cli first."
  exit 1
fi

npm version "$1" --no-git-tag-version
VERSION="$(node -p "require('./package.json').version")"

git -C "$REPO_ROOT" add "$CLI_DIR/package.json" "$CLI_DIR/package-lock.json" 2>/dev/null || true
git -C "$REPO_ROOT" commit -m "release v$VERSION"

npm run build

chmod +x dist/cli.js

node -e "const fs=require('fs');const data=fs.readFileSync('dist/cli.js','utf8');if(!data.startsWith('#!/usr/bin/env node')){console.error('missing shebang');process.exit(1);}"

PACK_FILE=$(npm pack)
rm -f "$PACK_FILE"

if [ -n "${NPM_OTP:-}" ]; then
  npm publish --otp "$NPM_OTP"
else
  npm publish
fi

git -C "$REPO_ROOT" tag "v$VERSION"
git -C "$REPO_ROOT" push --tags

echo ""
echo "released v$VERSION"
