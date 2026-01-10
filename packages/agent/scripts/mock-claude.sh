#!/bin/sh
set -e

COUNT_FILE="/tmp/wile-claude-mock-count"
if [ ! -f "$COUNT_FILE" ]; then
  echo "0" > "$COUNT_FILE"
fi

COUNT=$(cat "$COUNT_FILE")
NEXT_COUNT=$((COUNT + 1))
echo "$NEXT_COUNT" > "$COUNT_FILE"

if [ "${WILE_MOCK_MODE:-}" = "preflight_fail" ]; then
  PROGRESS_PATH=".wile/progress.txt"
  if [ -f "$PROGRESS_PATH" ]; then
    :
  else
    printf '%s\n' "# Wile Progress Log" "" "## Codebase Patterns" "" "---" > "$PROGRESS_PATH"
  fi

  DATE=$(date +%Y-%m-%d)
  cat >> "$PROGRESS_PATH" <<EOF

---

## ${DATE} - PREFLIGHT FAILED

**Checks run:**
- Mocked preflight check

**Failures:**
- Mocked preflight failure (WILE_MOCK_MODE=preflight_fail)
EOF

  cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"<promise>PREFLIGHT_FAILED</promise>\n"}]}}
JSON
  exit 0
fi

if [ "$COUNT" -eq 0 ]; then
  cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"ANSWER: 2\n"}]}}
JSON
else
  cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"<promise>ALL_STORIES_COMPLETED</promise>\n"}]}}
JSON
fi
