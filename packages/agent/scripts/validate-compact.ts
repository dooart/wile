#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type JsonObject = Record<string, unknown>;

const prdPath = ".wile/prd.json";
const progressPath = ".wile/progress.txt";
const prdOriginalPath = ".wile/prd.json.original";
const scriptPath = process.argv[1] ?? "validate-compact.ts";
const validatePrdPath = path.join(path.dirname(scriptPath), "validate-prd.ts");

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseStories = (value: unknown, errorMessage: string): JsonObject[] => {
  if (!Array.isArray(value)) {
    fail(errorMessage);
  }
  const values = value as unknown[];

  const stories: JsonObject[] = [];
  for (const entry of values) {
    if (!isObject(entry)) {
      fail(errorMessage);
    }
    stories.push(entry as JsonObject);
  }

  return stories;
};

const getStoryId = (story: JsonObject, errorPrefix: string): number => {
  const id = story.id;
  if (typeof id !== "number" || !Number.isInteger(id)) {
    fail(`${errorPrefix} story has invalid id.`);
  }
  return id as number;
};

const getStoryStatus = (story: JsonObject, errorPrefix: string): string => {
  const status = story.status;
  if (typeof status !== "string") {
    fail(`${errorPrefix} story ${getStoryId(story, errorPrefix)} has invalid status.`);
  }
  return status as string;
};

if (!existsSync(prdPath)) {
  fail("Missing .wile/prd.json after compact.");
}

if (!existsSync(progressPath)) {
  fail("Missing .wile/progress.txt after compact.");
}

const validateResult = spawnSync("bun", [validatePrdPath, "--path", prdPath], {
  encoding: "utf8"
});
if (validateResult.status !== 0) {
  const message = (validateResult.stderr || validateResult.stdout || "").trim();
  fail(message || "Compacted .wile/prd.json failed schema validation.");
}

let payload: unknown;
try {
  payload = JSON.parse(readFileSync(prdPath, "utf8"));
} catch {
  fail("Compacted .wile/prd.json is not valid JSON.");
}

if (!isObject(payload)) {
  fail('Compacted .wile/prd.json must contain a top-level "stories" array.');
}

const currentStories = parseStories(
  (payload as JsonObject).stories,
  'Compacted .wile/prd.json must contain a top-level "stories" array.'
);

if (existsSync(prdOriginalPath)) {
  let originalPayload: unknown;
  try {
    originalPayload = JSON.parse(readFileSync(prdOriginalPath, "utf8"));
  } catch {
    fail("Original .wile/prd.json.original is not valid JSON.");
  }

  if (!isObject(originalPayload)) {
    fail('Original .wile/prd.json.original must contain a top-level "stories" array.');
  }

  const originalStories = parseStories(
    (originalPayload as JsonObject).stories,
    'Original .wile/prd.json.original must contain a top-level "stories" array.'
  );

  const originalPending = originalStories.filter(
    (story) => getStoryStatus(story, "Original") === "pending"
  );
  const currentPending = currentStories.filter(
    (story) => getStoryStatus(story, "Compacted") === "pending"
  );

  if (originalPending.length !== currentPending.length) {
    fail("Compaction must preserve all pending stories.");
  }

  for (const story of originalPending) {
    const storyId = getStoryId(story, "Original");
    const currentStory = currentPending.find((candidate) => getStoryId(candidate, "Compacted") === storyId);
    if (!currentStory) {
      fail(`Compaction removed pending story ${storyId}.`);
    }
    if (JSON.stringify(currentStory) !== JSON.stringify(story)) {
      fail(`Compaction modified pending story ${storyId}. Pending stories must remain unchanged.`);
    }
  }
}

const progressText = readFileSync(progressPath, "utf8");
if (!progressText.startsWith("# Wile Progress Log")) {
  fail("Compacted progress log must start with # Wile Progress Log.");
}

if (!progressText.includes("## Codebase Patterns")) {
  fail("Compacted progress log must include ## Codebase Patterns.");
}
