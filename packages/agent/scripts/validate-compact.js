#!/usr/bin/env node
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const prdPath = ".wile/prd.json";
const progressPath = ".wile/progress.txt";
const prdOriginalPath = ".wile/prd.json.original";
const validatePrdPath = path.join(__dirname, "validate-prd.js");

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!fs.existsSync(prdPath)) {
  fail("Missing .wile/prd.json after compact.");
}

if (!fs.existsSync(progressPath)) {
  fail("Missing .wile/progress.txt after compact.");
}

const validateResult = spawnSync("node", [validatePrdPath, "--path", prdPath], {
  encoding: "utf8"
});
if (validateResult.status !== 0) {
  const message = (validateResult.stderr || validateResult.stdout || "").trim();
  fail(message || "Compacted .wile/prd.json failed schema validation.");
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(prdPath, "utf8"));
} catch {
  fail("Compacted .wile/prd.json is not valid JSON.");
}

if (!payload || !Array.isArray(payload.stories)) {
  fail('Compacted .wile/prd.json must contain a top-level "stories" array.');
}

if (fs.existsSync(prdOriginalPath)) {
  let original;
  try {
    original = JSON.parse(fs.readFileSync(prdOriginalPath, "utf8"));
  } catch {
    fail("Original .wile/prd.json.original is not valid JSON.");
  }

  if (!original || !Array.isArray(original.stories)) {
    fail('Original .wile/prd.json.original must contain a top-level "stories" array.');
  }

  const originalPending = original.stories.filter((story) => story?.status === "pending");
  const currentPending = payload.stories.filter((story) => story?.status === "pending");

  if (originalPending.length !== currentPending.length) {
    fail("Compaction must preserve all pending stories.");
  }

  for (const story of originalPending) {
    const currentStory = currentPending.find((candidate) => candidate?.id === story?.id);
    if (!currentStory) {
      fail(`Compaction removed pending story ${story.id}.`);
    }
    if (JSON.stringify(currentStory) !== JSON.stringify(story)) {
      fail(`Compaction modified pending story ${story.id}. Pending stories must remain unchanged.`);
    }
  }
}

const progressText = fs.readFileSync(progressPath, "utf8");
if (!progressText.startsWith("# Wile Progress Log")) {
  fail("Compacted progress log must start with # Wile Progress Log.");
}

if (!progressText.includes("## Codebase Patterns")) {
  fail("Compacted progress log must include ## Codebase Patterns.");
}
