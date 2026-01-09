#!/bin/sh
set -e

COUNT_FILE="/tmp/wile-claude-mock-count"
if [ ! -f "$COUNT_FILE" ]; then
  echo "0" > "$COUNT_FILE"
fi

COUNT=$(cat "$COUNT_FILE")
NEXT_COUNT=$((COUNT + 1))
echo "$NEXT_COUNT" > "$COUNT_FILE"

if [ "$COUNT" -eq 0 ]; then
  cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"ANSWER: 2\n"}]}}
JSON
else
  cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"<promise>COMPLETE</promise>\n"}]}}
JSON
fi
