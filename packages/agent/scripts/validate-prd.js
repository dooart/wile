#!/usr/bin/env node

const fs = require("node:fs");

const args = process.argv.slice(2);
let prdPath = ".wile/prd.json";
let summaryOnly = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--path") {
    const next = args[i + 1];
    if (!next) {
      console.error("Missing value for --path.");
      process.exit(1);
    }
    prdPath = next;
    i += 1;
    continue;
  }
  if (arg === "--summary") {
    summaryOnly = true;
    continue;
  }
  console.error(`Unknown argument: ${arg}`);
  process.exit(1);
}

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const toObject = (value, message) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(message);
  }
  return value;
};

const toInteger = (value, message) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(message);
  }
  return value;
};

const toNonEmptyString = (value, message) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(message);
  }
  return value;
};

const toStringArray = (value, message) => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    fail(message);
  }
  return value;
};

const toIntegerArray = (value, message) => {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number" && Number.isInteger(item))) {
    fail(message);
  }
  return value;
};

const parseStory = (raw, idx) => {
  const label = `stories[${idx}]`;
  const story = toObject(raw, `${label} must be an object.`);
  const status = story.status;
  if (status !== "pending" && status !== "done") {
    fail(`${label}.status must be "pending" or "done".`);
  }

  let compactedFrom;
  if (story.compactedFrom !== undefined) {
    compactedFrom = toIntegerArray(
      story.compactedFrom,
      `${label}.compactedFrom must be an array of integer story IDs.`
    );
    if (new Set(compactedFrom).size !== compactedFrom.length) {
      fail(`${label}.compactedFrom must not contain duplicate IDs.`);
    }
    if (status !== "done") {
      fail(`${label}.compactedFrom is only allowed when status is "done".`);
    }
  }

  return {
    id: toInteger(story.id, `${label}.id must be an integer number.`),
    title: toNonEmptyString(story.title, `${label}.title must be a non-empty string.`),
    description: toNonEmptyString(story.description, `${label}.description must be a non-empty string.`),
    acceptanceCriteria: toStringArray(
      story.acceptanceCriteria,
      `${label}.acceptanceCriteria must be an array of non-empty strings.`
    ),
    dependsOn: toIntegerArray(
      story.dependsOn,
      `${label}.dependsOn must be an array of integer story IDs.`
    ),
    compactedFrom,
    status
  };
};

const findCycle = (stories) => {
  const edges = new Map();
  for (const story of stories) {
    edges.set(story.id, story.dependsOn);
  }

  const visiting = new Set();
  const visited = new Set();
  const path = [];

  const dfs = (id) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      return start === -1 ? [id] : [...path.slice(start), id];
    }
    if (visited.has(id)) {
      return null;
    }

    visiting.add(id);
    path.push(id);
    for (const depId of edges.get(id) || []) {
      const cycle = dfs(depId);
      if (cycle) {
        return cycle;
      }
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  };

  for (const story of stories) {
    const cycle = dfs(story.id);
    if (cycle) {
      return cycle;
    }
  }

  return null;
};

if (!fs.existsSync(prdPath)) {
  fail(`Missing ${prdPath}.`);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(prdPath, "utf8"));
} catch {
  fail(`${prdPath} is not valid JSON.`);
}

const prd = toObject(payload, `${prdPath} must be a JSON object.`);
if (!Array.isArray(prd.stories)) {
  fail(`${prdPath} must contain a top-level "stories" array.`);
}

const stories = prd.stories.map((story, idx) => parseStory(story, idx));
const storyById = new Map();
for (const story of stories) {
  if (storyById.has(story.id)) {
    fail(`Duplicate story id detected: ${story.id}.`);
  }
  storyById.set(story.id, story);
}

const compactedById = new Map();
for (const story of stories) {
  for (const compactedId of story.compactedFrom || []) {
    if (compactedById.has(compactedId)) {
      fail(
        `Compacted story id ${compactedId} is listed multiple times (stories ${compactedById.get(compactedId)} and ${story.id}).`
      );
    }
    compactedById.set(compactedId, story.id);
  }
}

for (const [compactedId, ownerStoryId] of compactedById) {
  if (storyById.has(compactedId)) {
    fail(`Story id ${compactedId} is reserved by compactedFrom in story ${ownerStoryId}.`);
  }
}

for (const story of stories) {
  for (const depId of story.dependsOn) {
    const compactedOwner = compactedById.get(depId);
    if (compactedOwner !== undefined) {
      fail(`Story ${story.id} depends on compacted story id ${depId} (compacted in story ${compactedOwner}).`);
    }
    if (!storyById.has(depId)) {
      fail(`Story ${story.id} depends on missing story id ${depId}.`);
    }
  }
}

const cycle = findCycle(stories);
if (cycle) {
  fail(`Dependency cycle detected: ${cycle.join(" -> ")}.`);
}

const pendingStories = stories.filter((story) => story.status === "pending");
const runnableStory =
  stories.find(
    (story) =>
      story.status === "pending" &&
      story.dependsOn.every((depId) => storyById.get(depId).status === "done")
  ) || null;

if (pendingStories.length > 0 && !runnableStory) {
  const blocked = pendingStories.map((story) => story.id).join(", ");
  fail(`No runnable pending stories in ${prdPath}. Pending stories are blocked: ${blocked}.`);
}

if (summaryOnly) {
  console.log(
    JSON.stringify({
      pendingCount: pendingStories.length,
      runnableStoryId: runnableStory ? runnableStory.id : null,
      allDone: pendingStories.length === 0
    })
  );
}
