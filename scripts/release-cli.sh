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

node - "$1" <<'NODE'
const fs = require("fs");
const path = require("path");

const bump = process.argv[1];
const file = path.join(process.cwd(), "package.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const [major, minor, patch] = (data.version || "0.0.0").split(".").map(Number);

let next;
if (bump === "major") {
  next = [major + 1, 0, 0];
} else if (bump === "minor") {
  next = [major, minor + 1, 0];
} else if (bump === "patch") {
  next = [major, minor, patch + 1];
} else {
  throw new Error("invalid bump");
}

data.version = next.join(".");
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
NODE
VERSION=$(node -p "require('./package.json').version")

git -C "$ROOT_DIR" add "$CLI_DIR/package.json" "$CLI_DIR/package-lock.json" 2>/dev/null || true
git -C "$ROOT_DIR" commit -m "release v$VERSION"

bun run build
chmod +x dist/cli.js

node -e "const fs=require('fs');const data=fs.readFileSync('dist/cli.js','utf8');if(!data.startsWith('#!/usr/bin/env node')){console.error('missing shebang');process.exit(1);}"

echo "prepared v$VERSION"
