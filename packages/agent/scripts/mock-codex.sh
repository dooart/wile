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
const parseCompactedFromRanges = (value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  const ranges = [];
  const tokens = value.split(",").map((token) => token.trim()).filter(Boolean);
  for (const token of tokens) {
    const match = token.match(/^(-?\d+)(?:\.\.(-?\d+))?$/);
    if (!match) {
      continue;
    }

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
      continue;
    }

    ranges.push({ start, end });
  }

  ranges.sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range });
    } else if (range.end > last.end) {
      last.end = range.end;
    }
  }

  return merged;
};

const compactedIdsFromStory = (story) => {
  const ids = [];
  for (const range of parseCompactedFromRanges(story.compactedFrom)) {
    for (let id = range.start; id <= range.end; id += 1) {
      ids.push(id);
    }
  }
  return ids;
};

const compactedFromStringFromIds = (ids) => {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return "";
  }

  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const id = sorted[i];
    if (id === end + 1) {
      end = id;
      continue;
    }

    ranges.push({ start, end });
    start = id;
    end = id;
  }
  ranges.push({ start, end });

  return ranges
    .map((range) => (range.start === range.end ? `${range.start}` : `${range.start}..${range.end}`))
    .join(",");
};

const requiredDoneIds = new Set();
for (const story of pendingStories) {
  const deps = Array.isArray(story.dependsOn) ? story.dependsOn : [];
  for (const depId of deps) {
    requiredDoneIds.add(depId);
  }
}
const retainedDoneStories = doneStories.filter((story) => requiredDoneIds.has(story.id));
const compactableDoneStories = doneStories.filter((story) => !requiredDoneIds.has(story.id));

let maxReservedId = Math.max(0, ...stories.map((story) => (Number.isInteger(story.id) ? story.id : 0)));
for (const story of stories) {
  const ranges = parseCompactedFromRanges(story.compactedFrom);
  for (const range of ranges) {
    if (range.end > maxReservedId) {
      maxReservedId = range.end;
    }
  }
}
const summaryId = maxReservedId + 1;

const nextStories = [...pendingStories, ...retainedDoneStories];
if (compactableDoneStories.length > 0) {
  const compactedIds = [
    ...new Set(
      compactableDoneStories.flatMap((story) => {
        return [story.id, ...compactedIdsFromStory(story)];
      })
    )
  ];

  nextStories.push({
    id: summaryId,
    title: "[COMPACT] Completed stories summary",
    description: "Compacted completed stories into a high-level summary entry.",
    acceptanceCriteria: [
      "Historical summary for compacted completed work.",
      "Pending stories were preserved unchanged."
    ],
    dependsOn: [],
    compactedFrom: compactedFromStringFromIds(compactedIds),
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
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"{\"summaryStoryId\":999,\"summaryTitle\":\"[COMPACT] Completed stories summary\"}\n"}}
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
