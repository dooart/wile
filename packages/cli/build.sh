#!/bin/sh
set -e
bun run build
chmod +x dist/cli.js
