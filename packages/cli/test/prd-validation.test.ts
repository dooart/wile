import { test, expect } from "bun:test";
import { validatePrd } from "../src/lib/prd";

test("validatePrd accepts valid schema and picks first runnable pending story", () => {
  const result = validatePrd({
    stories: [
      {
        id: 1,
        title: "Done base",
        description: "Already completed",
        acceptanceCriteria: ["done"],
        dependsOn: [],
        status: "done"
      },
      {
        id: 2,
        title: "Depends on 1",
        description: "Ready now",
        acceptanceCriteria: ["works"],
        dependsOn: [1],
        status: "pending"
      },
      {
        id: 3,
        title: "Depends on 2",
        description: "Blocked",
        acceptanceCriteria: ["works"],
        dependsOn: [2],
        status: "pending"
      }
    ]
  });

  expect(result.allDone).toBe(false);
  expect(result.pendingStories.length).toBe(2);
  expect(result.runnableStory?.id).toBe(2);
});

test("validatePrd allows depending on a story that appears later in array order", () => {
  const result = validatePrd({
    stories: [
      {
        id: 1,
        title: "Later dependency",
        description: "Can still run because dependency is done",
        acceptanceCriteria: ["works"],
        dependsOn: [2],
        status: "pending"
      },
      {
        id: 2,
        title: "Dependency",
        description: "Already done",
        acceptanceCriteria: ["done"],
        dependsOn: [],
        status: "done"
      }
    ]
  });

  expect(result.runnableStory?.id).toBe(1);
});

test("validatePrd rejects duplicate ids", () => {
  expect(() =>
    validatePrd({
      stories: [
        {
          id: 1,
          title: "One",
          description: "desc",
          acceptanceCriteria: ["ok"],
          dependsOn: [],
          status: "pending"
        },
        {
          id: 1,
          title: "Duplicate",
          description: "desc",
          acceptanceCriteria: ["ok"],
          dependsOn: [],
          status: "pending"
        }
      ]
    })
  ).toThrow("Duplicate story id detected: 1.");
});

test("validatePrd rejects missing dependency ids", () => {
  expect(() =>
    validatePrd({
      stories: [
        {
          id: 1,
          title: "One",
          description: "desc",
          acceptanceCriteria: ["ok"],
          dependsOn: [999],
          status: "pending"
        }
      ]
    })
  ).toThrow("Story 1 depends on missing story id 999.");
});

test("validatePrd rejects dependency cycles", () => {
  expect(() =>
    validatePrd({
      stories: [
        {
          id: 1,
          title: "One",
          description: "desc",
          acceptanceCriteria: ["ok"],
          dependsOn: [2],
          status: "pending"
        },
        {
          id: 2,
          title: "Two",
          description: "desc",
          acceptanceCriteria: ["ok"],
          dependsOn: [1],
          status: "pending"
        }
      ]
    })
  ).toThrow("Dependency cycle detected: 1 -> 2 -> 1.");
});

test("validatePrd accepts compactedFrom on done summary stories", () => {
  const result = validatePrd({
    stories: [
      {
        id: 10,
        title: "Compacted summary",
        description: "Historical summary",
        acceptanceCriteria: ["Summary exists"],
        dependsOn: [],
        compactedFrom: [2, 3, 4, 8],
        status: "done"
      },
      {
        id: 11,
        title: "New pending task",
        description: "Ready to run",
        acceptanceCriteria: ["works"],
        dependsOn: [],
        status: "pending"
      }
    ]
  });

  expect(result.runnableStory?.id).toBe(11);
});

test("validatePrd rejects active story ids that are reserved by compactedFrom", () => {
  expect(() =>
    validatePrd({
      stories: [
        {
          id: 10,
          title: "Compacted summary",
          description: "Historical summary",
          acceptanceCriteria: ["Summary exists"],
          dependsOn: [],
          compactedFrom: [2, 3, 4, 8],
          status: "done"
        },
        {
          id: 3,
          title: "Reused id",
          description: "invalid",
          acceptanceCriteria: ["nope"],
          dependsOn: [],
          status: "pending"
        }
      ]
    })
  ).toThrow("Story id 3 is reserved by compactedFrom in story 10.");
});

test("validatePrd rejects dependsOn references to compacted ids", () => {
  expect(() =>
    validatePrd({
      stories: [
        {
          id: 10,
          title: "Compacted summary",
          description: "Historical summary",
          acceptanceCriteria: ["Summary exists"],
          dependsOn: [],
          compactedFrom: [2, 3, 4, 8],
          status: "done"
        },
        {
          id: 11,
          title: "Depends on compacted",
          description: "invalid",
          acceptanceCriteria: ["nope"],
          dependsOn: [3],
          status: "pending"
        }
      ]
    })
  ).toThrow("Story 11 depends on compacted story id 3 (compacted in story 10).");
});

test("validatePrd rejects duplicate compactedFrom ids across summary stories", () => {
  expect(() =>
    validatePrd({
      stories: [
        {
          id: 10,
          title: "Summary A",
          description: "A",
          acceptanceCriteria: ["A"],
          dependsOn: [],
          compactedFrom: [2, 3],
          status: "done"
        },
        {
          id: 11,
          title: "Summary B",
          description: "B",
          acceptanceCriteria: ["B"],
          dependsOn: [],
          compactedFrom: [3, 4],
          status: "done"
        }
      ]
    })
  ).toThrow("Compacted story id 3 is listed multiple times (stories 10 and 11).");
});
