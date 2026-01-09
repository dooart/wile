#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
CLI_DIR="$ROOT_DIR/packages/cli"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

if [ "$#" -ne 0 ]; then
  echo "usage: $0" >&2
  exit 1
fi

if ! git -C "$ROOT_DIR" diff --quiet || ! git -C "$ROOT_DIR" diff --staged --quiet; then
  echo "error: git working tree is not clean; commit or stash changes first" >&2
  exit 1
fi

cd "$CLI_DIR"

if [ -z "${NPM_TOKEN:-}" ]; then
  if ! npm whoami >/dev/null 2>&1; then
    echo "error: npm is not authenticated. set NPM_TOKEN or run 'npm login' in packages/cli first." >&2
    exit 1
  fi
fi

VERSION=$(node -p "require('./package.json').version")

if git -C "$ROOT_DIR" rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "error: git tag v$VERSION already exists" >&2
  exit 1
fi

if [ ! -f dist/cli.js ]; then
  echo "error: dist/cli.js not found. run scripts/release-cli.sh first." >&2
  exit 1
fi

node -e "const fs=require('fs');const data=fs.readFileSync('dist/cli.js','utf8');if(!data.startsWith('#!/usr/bin/env node')){console.error('missing shebang');process.exit(1);}"

PACK_FILE=$(npm pack)
rm -f "$PACK_FILE"

PUBLISH_ARGS=""
if [ -n "${NPM_OTP:-}" ]; then
  PUBLISH_ARGS="$PUBLISH_ARGS --otp $NPM_OTP"
fi
if [ -n "${NPM_TOKEN:-}" ]; then
  PUBLISH_ARGS="$PUBLISH_ARGS --//registry.npmjs.org/:_authToken=$NPM_TOKEN"
fi

if [ -n "$PUBLISH_ARGS" ]; then
  npm publish $PUBLISH_ARGS
else
  npm publish
fi

git -C "$ROOT_DIR" tag "v$VERSION"
git -C "$ROOT_DIR" push
git -C "$ROOT_DIR" push --tags

echo "published v$VERSION"
