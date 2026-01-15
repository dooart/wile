#!/usr/bin/env node
const fs = require("node:fs");

const prdPath = ".wile/prd.json";
const progressPath = ".wile/progress.txt";
const prdOriginalPath = ".wile/prd.json.original";

if (!fs.existsSync(prdPath)) {
  console.error("Missing .wile/prd.json after compact.");
  process.exit(1);
}

if (!fs.existsSync(progressPath)) {
  console.error("Missing .wile/progress.txt after compact.");
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(prdPath, "utf8"));
} catch {
  console.error("Compacted .wile/prd.json is not valid JSON.");
  process.exit(1);
}

if (!payload || !Array.isArray(payload.userStories) || payload.userStories.length === 0) {
  console.error("Compacted .wile/prd.json must contain at least one user story.");
  process.exit(1);
}

const groupStory = payload.userStories.find((story) => story?.id === "GROUP-001");
if (!groupStory) {
  console.error('Compacted .wile/prd.json must include a GROUP-001 story.');
  process.exit(1);
}

const requiredKeys = ["id", "title", "tasks", "taskIds", "priority", "passes", "notes"];
for (const key of requiredKeys) {
  if (!(key in groupStory)) {
    console.error(`Compact output missing key: ${key}`);
    process.exit(1);
  }
}

if (groupStory.id !== "GROUP-001") {
  console.error('Compact output "id" must be GROUP-001.');
  process.exit(1);
}

if (typeof groupStory.title !== "string" || groupStory.title.trim().length === 0) {
  console.error('Compact output "title" must be a non-empty string.');
  process.exit(1);
}

if (!Array.isArray(groupStory.tasks) || groupStory.tasks.length === 0) {
  console.error('Compact output "tasks" must be a non-empty array.');
  process.exit(1);
}

if (!groupStory.tasks.every((task) => typeof task === "string" && task.trim().length > 0)) {
  console.error('Compact output "tasks" must contain only non-empty strings.');
  process.exit(1);
}

if (typeof groupStory.taskIds !== "string" || groupStory.taskIds.trim().length === 0) {
  console.error('Compact output "taskIds" must be a non-empty string.');
  process.exit(1);
}

if (typeof groupStory.priority !== "number" || !Number.isFinite(groupStory.priority)) {
  console.error('Compact output "priority" must be a number.');
  process.exit(1);
}

if (groupStory.passes !== true) {
  console.error('Compact output "passes" must be true.');
  process.exit(1);
}

if (groupStory.notes !== "Don't repeat task ids when starting the next one.") {
  console.error('Compact output "notes" must match the required text.');
  process.exit(1);
}

if (fs.existsSync(prdOriginalPath)) {
  let original;
  try {
    original = JSON.parse(fs.readFileSync(prdOriginalPath, "utf8"));
  } catch {
    console.error("Original .wile/prd.json.original is not valid JSON.");
    process.exit(1);
  }
  if (!original || !Array.isArray(original.userStories)) {
    console.error("Original .wile/prd.json.original is missing userStories.");
    process.exit(1);
  }
  const originalPending = original.userStories.filter((story) => story?.passes === false);
  const currentPending = payload.userStories.filter((story) => story?.passes === false);
  if (originalPending.length !== currentPending.length) {
    console.error("Compaction must preserve all passes:false stories.");
    process.exit(1);
  }
  const missingPending = originalPending.filter(
    (story) => !currentPending.some((current) => current?.id === story?.id)
  );
  if (missingPending.length > 0) {
    console.error("Compaction removed passes:false stories.");
    process.exit(1);
  }

  const originalGroups = original.userStories.filter((story) =>
    typeof story?.id === "string" && story.id.startsWith("GROUP-"),
  );
  const currentGroups = payload.userStories.filter((story) =>
    typeof story?.id === "string" && story.id.startsWith("GROUP-"),
  );
  const missingGroups = originalGroups.filter(
    (story) => !currentGroups.some((current) => current?.id === story?.id),
  );
  if (missingGroups.length > 0) {
    console.error("Compaction removed existing grouped stories.");
    process.exit(1);
  }
}

const progressText = fs.readFileSync(progressPath, "utf8");
if (!progressText.startsWith("# Wile Progress Log")) {
  console.error("Compacted progress log must start with # Wile Progress Log.");
  process.exit(1);
}

if (!progressText.includes("## Codebase Patterns")) {
  console.error("Compacted progress log must include ## Codebase Patterns.");
  process.exit(1);
}
