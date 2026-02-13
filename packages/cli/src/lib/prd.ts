import { readFileSync } from "node:fs";

export type StoryStatus = "pending" | "done";

export type PrdStory = {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: number[];
  compactedFrom?: string;
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

type IdRange = {
  start: number;
  end: number;
};

type ParsedPrdStory = PrdStory & {
  compactedFromRanges?: IdRange[];
};

type ReservedRange = IdRange & {
  ownerStoryId: number;
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

const compactedFromFormatError =
  'must use canonical range syntax like "1..3,5" (sorted, non-overlapping).';

const parseCompactedFrom = (value: unknown, label: string): { value: string; ranges: IdRange[] } => {
  const raw = toNonEmptyString(
    value,
    `${label}.compactedFrom ${compactedFromFormatError}`
  ).trim();
  const tokens = raw.split(",").map((token) => token.trim());
  if (tokens.length === 0 || tokens.some((token) => token.length === 0)) {
    throw new Error(`${label}.compactedFrom ${compactedFromFormatError}`);
  }

  const parsed: IdRange[] = [];
  for (const token of tokens) {
    const match = token.match(/^(-?\d+)(?:\.\.(-?\d+))?$/);
    if (!match) {
      throw new Error(`${label}.compactedFrom ${compactedFromFormatError}`);
    }

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
      throw new Error(`${label}.compactedFrom ${compactedFromFormatError}`);
    }

    parsed.push({ start, end });
  }

  parsed.sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));

  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i].start <= parsed[i - 1].end) {
      throw new Error(`${label}.compactedFrom ${compactedFromFormatError}`);
    }
  }

  const merged: IdRange[] = [];
  for (const range of parsed) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range });
      continue;
    }
    if (range.end > last.end) {
      last.end = range.end;
    }
  }

  const canonical = merged
    .map((range) => (range.start === range.end ? `${range.start}` : `${range.start}..${range.end}`))
    .join(",");
  const normalizedInput = tokens.join(",");
  if (normalizedInput !== canonical) {
    throw new Error(`${label}.compactedFrom ${compactedFromFormatError}`);
  }

  return {
    value: canonical,
    ranges: merged
  };
};

const parsePrdStory = (storyRaw: unknown, index: number): ParsedPrdStory => {
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

  let compactedFrom: string | undefined;
  let compactedFromRanges: IdRange[] | undefined;
  if (story.compactedFrom !== undefined) {
    if (status !== "done") {
      throw new Error(`${label}.compactedFrom is only allowed when status is "done".`);
    }

    const parsedCompactedFrom = parseCompactedFrom(story.compactedFrom, label);
    compactedFrom = parsedCompactedFrom.value;
    compactedFromRanges = parsedCompactedFrom.ranges;
  }

  return {
    id,
    title,
    description,
    acceptanceCriteria,
    dependsOn,
    compactedFrom,
    compactedFromRanges,
    status
  };
};

const findDependencyCycle = (stories: ParsedPrdStory[]) => {
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

const findReservedOwner = (id: number, reservedRanges: ReservedRange[]) => {
  for (const range of reservedRanges) {
    if (id >= range.start && id <= range.end) {
      return range.ownerStoryId;
    }
  }
  return undefined;
};

const toPublicStory = (story: ParsedPrdStory): PrdStory => {
  const publicStory = { ...story };
  delete publicStory.compactedFromRanges;
  return publicStory;
};

export const validatePrd = (raw: unknown): PrdValidationResult => {
  const payload = toObject(raw, "prd.json must be a JSON object.");
  if (!Array.isArray(payload.stories)) {
    throw new Error('prd.json must contain a top-level "stories" array.');
  }

  const stories = payload.stories.map((item, idx) => parsePrdStory(item, idx));
  const storyById = new Map<number, ParsedPrdStory>();
  for (const story of stories) {
    if (storyById.has(story.id)) {
      throw new Error(`Duplicate story id detected: ${story.id}.`);
    }
    storyById.set(story.id, story);
  }

  const reservedRanges: ReservedRange[] = [];
  for (const story of stories) {
    for (const range of story.compactedFromRanges ?? []) {
      for (const existingRange of reservedRanges) {
        if (range.start <= existingRange.end && existingRange.start <= range.end) {
          const overlapId = Math.max(range.start, existingRange.start);
          throw new Error(
            `Compacted story id ${overlapId} is listed multiple times (stories ${existingRange.ownerStoryId} and ${story.id}).`
          );
        }
      }

      reservedRanges.push({
        start: range.start,
        end: range.end,
        ownerStoryId: story.id
      });
    }
  }

  for (const story of stories) {
    const ownerStoryId = findReservedOwner(story.id, reservedRanges);
    if (ownerStoryId !== undefined) {
      throw new Error(`Story id ${story.id} is reserved by compactedFrom in story ${ownerStoryId}.`);
    }
  }

  for (const story of stories) {
    for (const depId of story.dependsOn) {
      const compactedOwner = findReservedOwner(depId, reservedRanges);
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
    prd: { stories: stories.map(toPublicStory) },
    pendingStories: pendingStories.map(toPublicStory),
    runnableStory: runnableStory ? toPublicStory(runnableStory) : null,
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
