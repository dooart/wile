#!/bin/sh
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
CLI_DIR="$ROOT_DIR/packages/cli"

cd "$CLI_DIR"

if ! npm whoami >/dev/null 2>&1; then
  echo "ERROR: npm is not authenticated. Run 'npm login' in packages/cli first." >&2
  exit 1
fi

VERSION=$(node -p "require('./package.json').version")

bun run build
chmod +x dist/cli.js

node -e "const fs=require('fs');const data=fs.readFileSync('dist/cli.js','utf8');if(!data.startsWith('#!/usr/bin/env node')){console.error('Missing shebang');process.exit(1);}"

PACK_FILE=$(npm pack)
rm -f "$PACK_FILE"

if [ -n "${NPM_OTP:-}" ]; then
  npm publish --otp "$NPM_OTP"
else
  npm publish
fi

TEST_DIR=$(mktemp -d /tmp/wile-bunx-XXXXXX)
cd "$TEST_DIR"
bunx wile --help >/dev/null

cd "$ROOT_DIR"

git add -A
if git diff --cached --quiet; then
  git commit --allow-empty -m "chore: publish wile v$VERSION"
else
  git commit -m "chore: publish wile v$VERSION"
fi

git tag "v$VERSION"

echo "Publish complete: v$VERSION"
