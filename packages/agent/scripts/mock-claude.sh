#!/bin/sh
set -e

if [ "${WILE_MODE:-}" = "compact" ]; then
  node - <<'NODE'
const fs = require("fs");

const prdPath = ".wile/prd.json";
const progressPath = ".wile/progress.txt";
const prd = JSON.parse(fs.readFileSync(prdPath, "utf8"));
const stories = Array.isArray(prd.stories) ? prd.stories : [];
const pendingStories = stories.filter((story) => story.status === "pending");
const doneStories = stories.filter((story) => story.status === "done");
const requiredDoneIds = new Set();
for (const story of pendingStories) {
  const deps = Array.isArray(story.dependsOn) ? story.dependsOn : [];
  for (const depId of deps) {
    requiredDoneIds.add(depId);
  }
}
const retainedDoneStories = doneStories.filter((story) => requiredDoneIds.has(story.id));
const compactableDoneStories = doneStories.filter((story) => !requiredDoneIds.has(story.id));
const reservedIds = new Set(stories.map((story) => story.id));
for (const story of stories) {
  const priorCompacted = Array.isArray(story.compactedFrom) ? story.compactedFrom : [];
  for (const compactedId of priorCompacted) {
    reservedIds.add(compactedId);
  }
}
const summaryId = Math.max(0, ...reservedIds) + 1;

const nextStories = [...pendingStories, ...retainedDoneStories];
if (compactableDoneStories.length > 0) {
  const compactedFrom = [
    ...new Set(
      compactableDoneStories.flatMap((story) => {
        const priorCompacted = Array.isArray(story.compactedFrom) ? story.compactedFrom : [];
        return [story.id, ...priorCompacted];
      })
    )
  ].sort((a, b) => a - b);

  nextStories.push({
    id: summaryId,
    title: "[COMPACT] Completed stories summary",
    description: "Compacted completed stories into a high-level summary entry.",
    acceptanceCriteria: [
      "Historical summary for compacted completed work.",
      "Pending stories were preserved unchanged."
    ],
    dependsOn: [],
    compactedFrom,
    status: "done"
  });
}

fs.writeFileSync(prdPath, JSON.stringify({ stories: nextStories }, null, 2) + "\n");

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
{"type":"assistant","message":{"content":[{"type":"text","text":"{\"summaryStoryId\":999,\"summaryTitle\":\"[COMPACT] Completed stories summary\"}\n"}]}}
JSON
  exit 0
fi

COUNT_FILE="/tmp/wile-claude-mock-count"
if [ ! -f "$COUNT_FILE" ]; then
  echo "0" > "$COUNT_FILE"
fi

COUNT=$(cat "$COUNT_FILE")
NEXT_COUNT=$((COUNT + 1))
echo "$NEXT_COUNT" > "$COUNT_FILE"

MODE=${WILE_MOCK_MODE:-}
if [ -n "$MODE" ] && { [ "$MODE" = "preflight_fail" ] || [ "$MODE" = "preflight_fail_split" ] || [ "$MODE" = "preflight_fail_trailing" ]; }; then
  if [ "$MODE" = "preflight_fail_trailing" ] && [ "$COUNT" -ne 0 ]; then
    :
  else
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

    if [ "$MODE" = "preflight_fail_split" ]; then
      cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"<\npromise>PREFLIGHT_FAILED</promise>\n"}]}}
JSON
    elif [ "$MODE" = "preflight_fail_trailing" ]; then
      cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"<promise>PREFLIGHT_FAILED</promise> trailing\n"}]}}
JSON
    else
      cat <<'JSON'
{"type":"assistant","message":{"content":[{"type":"text","text":"<promise>PREFLIGHT_FAILED</promise>\n"}]}}
JSON
    fi
    exit 0
  fi
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
