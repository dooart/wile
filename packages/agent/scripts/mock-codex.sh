#!/bin/sh
set -e

if [ "${WILE_MODE:-}" = "compact" ]; then
  node - <<'NODE'
const fs = require("fs");

const prdPath = ".wile/prd.json";
const progressPath = ".wile/progress.txt";
const prd = JSON.parse(fs.readFileSync(prdPath, "utf8"));
const stories = Array.isArray(prd.userStories) ? prd.userStories : [];
const firstStory = stories[0] || {};
const lastStory = stories[stories.length - 1] || {};
const priority = typeof firstStory.priority === "number" ? firstStory.priority : 1;
const taskIds = `From ${firstStory.id || "TASK-001"} to ${lastStory.id || "TASK-001"}`;

const compactStory = {
  id: "GROUP-001",
  title: "summary of everything done here",
  tasks: [
    "High level of what was accomplished here",
    "Should NOT have all tasks in here, should be very summarized"
  ],
  taskIds,
  priority,
  passes: true,
  notes: "Don't repeat task ids when starting the next one."
};

fs.writeFileSync(prdPath, JSON.stringify({ userStories: [compactStory] }, null, 2) + "\n");

const progressLines = [
  "# Wile Progress Log",
  "",
  "## Codebase Patterns",
  "- Summarized key learnings for future agents.",
  "",
  "---",
  "",
  "Compacted the progress log to highlight the most important work and patterns.",
  "Kept only high-level details to preserve context without noise.",
  ""
];

fs.writeFileSync(progressPath, progressLines.join("\n"));
NODE

  cat <<'JSON'
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"{\"id\":\"GROUP-001\",\"title\":\"summary of everything done here\",\"tasks\":[\"High level of what was accomplished here\",\"Should NOT have all tasks in here, should be very summarized\"],\"taskIds\":\"From TASK-001 to TASK-029\",\"priority\":1,\"passes\":true,\"notes\":\"Don't repeat task ids when starting the next one.\"}\n"}}
JSON
  exit 0
fi

COUNT_FILE="/tmp/wile-codex-mock-count"
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
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"<promise>PREFLIGHT_FAILED</promise>\n"}}
JSON
  exit 0
fi

if [ "$COUNT" -eq 0 ]; then
  cat <<'JSON'
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"ANSWER: 2\n"}}
JSON
else
  cat <<'JSON'
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"<promise>ALL_STORIES_COMPLETED</promise>\n"}}
JSON
fi
