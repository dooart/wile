import { readFileSync } from "node:fs";

export type StoryStatus = "pending" | "done";

export type PrdStory = {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: number[];
  compactedFrom?: number[];
  status: StoryStatus;
};

export type PrdDocument = {
  stories: PrdStory[];
};

export type PrdValidationResult = {
  prd: PrdDocument;
  pendingStories: PrdStory[];
  runnableStory: PrdStory | null;
  allDone: boolean;
};

const toObject = (value: unknown, message: string) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
};

const toNonEmptyString = (value: unknown, message: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
  return value;
};

const toInteger = (value: unknown, message: string) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(message);
  }
  return value;
};

const toStringArray = (value: unknown, message: string) => {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
  if (!value.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(message);
  }
  return value as string[];
};

const toIntegerArray = (value: unknown, message: string) => {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }
  if (!value.every((item) => typeof item === "number" && Number.isInteger(item))) {
    throw new Error(message);
  }
  return value as number[];
};

const parsePrdStory = (storyRaw: unknown, index: number): PrdStory => {
  const label = `stories[${index}]`;
  const story = toObject(storyRaw, `${label} must be an object.`);
  const id = toInteger(story.id, `${label}.id must be an integer number.`);
  const title = toNonEmptyString(story.title, `${label}.title must be a non-empty string.`);
  const description = toNonEmptyString(
    story.description,
    `${label}.description must be a non-empty string.`
  );
  const acceptanceCriteria = toStringArray(
    story.acceptanceCriteria,
    `${label}.acceptanceCriteria must be an array of non-empty strings.`
  );
  const dependsOn = toIntegerArray(
    story.dependsOn,
    `${label}.dependsOn must be an array of integer story IDs.`
  );
  const status = story.status;
  if (status !== "pending" && status !== "done") {
    throw new Error(`${label}.status must be "pending" or "done".`);
  }

  let compactedFrom: number[] | undefined;
  if (story.compactedFrom !== undefined) {
    compactedFrom = toIntegerArray(
      story.compactedFrom,
      `${label}.compactedFrom must be an array of integer story IDs.`
    );
    if (new Set(compactedFrom).size !== compactedFrom.length) {
      throw new Error(`${label}.compactedFrom must not contain duplicate IDs.`);
    }
    if (status !== "done") {
      throw new Error(`${label}.compactedFrom is only allowed when status is "done".`);
    }
  }

  return {
    id,
    title,
    description,
    acceptanceCriteria,
    dependsOn,
    compactedFrom,
    status
  };
};

const findDependencyCycle = (stories: PrdStory[]) => {
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
    for (const dep of deps) {
      const cycle = dfs(dep);
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

export const validatePrd = (raw: unknown): PrdValidationResult => {
  const payload = toObject(raw, "prd.json must be a JSON object.");
  if (!Array.isArray(payload.stories)) {
    throw new Error('prd.json must contain a top-level "stories" array.');
  }

  const stories = payload.stories.map((item, idx) => parsePrdStory(item, idx));
  const storyById = new Map<number, PrdStory>();
  for (const story of stories) {
    if (storyById.has(story.id)) {
      throw new Error(`Duplicate story id detected: ${story.id}.`);
    }
    storyById.set(story.id, story);
  }

  const compactedById = new Map<number, number>();
  for (const story of stories) {
    for (const compactedId of story.compactedFrom ?? []) {
      if (compactedById.has(compactedId)) {
        throw new Error(
          `Compacted story id ${compactedId} is listed multiple times (stories ${compactedById.get(compactedId)} and ${story.id}).`
        );
      }
      compactedById.set(compactedId, story.id);
    }
  }

  for (const [compactedId, ownerStoryId] of compactedById) {
    if (storyById.has(compactedId)) {
      throw new Error(`Story id ${compactedId} is reserved by compactedFrom in story ${ownerStoryId}.`);
    }
  }

  for (const story of stories) {
    for (const depId of story.dependsOn) {
      const compactedOwner = compactedById.get(depId);
      if (compactedOwner !== undefined) {
        throw new Error(
          `Story ${story.id} depends on compacted story id ${depId} (compacted in story ${compactedOwner}).`
        );
      }
      if (!storyById.has(depId)) {
        throw new Error(`Story ${story.id} depends on missing story id ${depId}.`);
      }
    }
  }

  const cycle = findDependencyCycle(stories);
  if (cycle) {
    throw new Error(`Dependency cycle detected: ${cycle.join(" -> ")}.`);
  }

  const pendingStories = stories.filter((story) => story.status === "pending");
  const runnableStory =
    stories.find(
      (story) =>
        story.status === "pending" &&
        story.dependsOn.every((depId) => storyById.get(depId)?.status === "done")
    ) ?? null;

  if (pendingStories.length > 0 && !runnableStory) {
    const blockedIds = pendingStories.map((story) => story.id).join(", ");
    throw new Error(
      `No runnable pending stories in prd.json. Pending stories are blocked: ${blockedIds}.`
    );
  }

  return {
    prd: { stories },
    pendingStories,
    runnableStory,
    allDone: pendingStories.length === 0
  };
};

export const readAndValidatePrd = (path: string) => {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`Failed to read ${path}. Ensure it is valid JSON.`);
  }
  return validatePrd(raw);
};
