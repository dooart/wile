#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";

type JsonObject = Record<string, unknown>;
type StoryStatus = "pending" | "done";

interface Story {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: number[];
  compactedFrom?: number[];
  status: StoryStatus;
}

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toObject = (value: unknown, message: string): JsonObject => {
  if (!isObject(value)) {
    fail(message);
  }
  return value as JsonObject;
};

const toInteger = (value: unknown, message: string): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(message);
  }
  return value as number;
};

const toNonEmptyString = (value: unknown, message: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(message);
  }
  return value as string;
};

const toStringArray = (value: unknown, message: string): string[] => {
  if (!Array.isArray(value)) {
    fail(message);
  }
  const values = value as unknown[];

  const items: string[] = [];
  for (const item of values) {
    if (typeof item !== "string" || item.trim().length === 0) {
      fail(message);
    }
    items.push(item as string);
  }
  return items;
};

const toIntegerArray = (value: unknown, message: string): number[] => {
  if (!Array.isArray(value)) {
    fail(message);
  }
  const values = value as unknown[];

  const items: number[] = [];
  for (const item of values) {
    if (typeof item !== "number" || !Number.isInteger(item)) {
      fail(message);
    }
    items.push(item as number);
  }
  return items;
};

const parseStory = (raw: unknown, idx: number): Story => {
  const label = `stories[${idx}]`;
  const storyObj = toObject(raw, `${label} must be an object.`);

  const statusRaw = storyObj.status;
  if (statusRaw !== "pending" && statusRaw !== "done") {
    fail(`${label}.status must be "pending" or "done".`);
  }

  let compactedFrom: number[] | undefined;
  if (storyObj.compactedFrom !== undefined) {
    compactedFrom = toIntegerArray(
      storyObj.compactedFrom,
      `${label}.compactedFrom must be an array of integer story IDs.`
    );
    if (new Set(compactedFrom).size !== compactedFrom.length) {
      fail(`${label}.compactedFrom must not contain duplicate IDs.`);
    }
    if (statusRaw !== "done") {
      fail(`${label}.compactedFrom is only allowed when status is "done".`);
    }
  }

  return {
    id: toInteger(storyObj.id, `${label}.id must be an integer number.`),
    title: toNonEmptyString(storyObj.title, `${label}.title must be a non-empty string.`),
    description: toNonEmptyString(
      storyObj.description,
      `${label}.description must be a non-empty string.`
    ),
    acceptanceCriteria: toStringArray(
      storyObj.acceptanceCriteria,
      `${label}.acceptanceCriteria must be an array of non-empty strings.`
    ),
    dependsOn: toIntegerArray(
      storyObj.dependsOn,
      `${label}.dependsOn must be an array of integer story IDs.`
    ),
    compactedFrom,
    status: statusRaw as StoryStatus
  };
};

const findCycle = (stories: Story[]): number[] | null => {
  const edges = new Map<number, number[]>();
  for (const story of stories) {
    edges.set(story.id, story.dependsOn);
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();
  const path: number[] = [];

  const dfs = (id: number): number[] | null => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      return start === -1 ? [id] : [...path.slice(start), id];
    }
    if (visited.has(id)) {
      return null;
    }

    visiting.add(id);
    path.push(id);

    const deps = edges.get(id) ?? [];
    for (const depId of deps) {
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

const args = process.argv.slice(2);
let prdPath = ".wile/prd.json";
let summaryOnly = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === "--path") {
    const next = args[i + 1];
    if (!next) {
      fail("Missing value for --path.");
    }
    prdPath = next;
    i += 1;
    continue;
  }

  if (arg === "--summary") {
    summaryOnly = true;
    continue;
  }

  fail(`Unknown argument: ${arg}`);
}

if (!existsSync(prdPath)) {
  fail(`Missing ${prdPath}.`);
}

let payload: unknown;
try {
  payload = JSON.parse(readFileSync(prdPath, "utf8"));
} catch {
  fail(`${prdPath} is not valid JSON.`);
}

const prdObj = toObject(payload, `${prdPath} must be a JSON object.`);
const rawStories = prdObj.stories;
if (!Array.isArray(rawStories)) {
  fail(`${prdPath} must contain a top-level "stories" array.`);
}
const storyItems = rawStories as unknown[];

const stories: Story[] = storyItems.map((story: unknown, idx: number) => parseStory(story, idx));
const storyById = new Map<number, Story>();
for (const story of stories) {
  if (storyById.has(story.id)) {
    fail(`Duplicate story id detected: ${story.id}.`);
  }
  storyById.set(story.id, story);
}

const compactedById = new Map<number, number>();
for (const story of stories) {
  for (const compactedId of story.compactedFrom ?? []) {
    const existingOwner = compactedById.get(compactedId);
    if (existingOwner !== undefined) {
      fail(
        `Compacted story id ${compactedId} is listed multiple times (stories ${existingOwner} and ${story.id}).`
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
      fail(
        `Story ${story.id} depends on compacted story id ${depId} (compacted in story ${compactedOwner}).`
      );
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
      story.dependsOn.every((depId) => storyById.get(depId)?.status === "done")
  ) ?? null;

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
