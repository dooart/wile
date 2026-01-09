#!/bin/sh
set -e
bun run build
chmod +x dist/cli.js
rm -rf dist/agent
cp -R ../agent dist/agent
