You are running a one-shot compaction task.

Goal: compact both `.wile/prd.json` and `.wile/progress.txt` while preserving important information.

Steps:
1. Read `.wile/prd.json` and `.wile/progress.txt`.
2. Update `.wile/prd.json` to:
   - Keep every story where `passes` is `false` exactly as-is.
   - Replace all stories where `passes` is `true` with a single grouped story.
   - The final structure must be: `{ "userStories": [ { ...GROUP-001... }, ...all-passes-false-stories ] }`.
   - The grouped story must use `id: "GROUP-001"`.
   - `title`: a concise summary of everything done.
   - `tasks`: 2-4 short bullet items derived from the summary tasks.
   - `taskIds`: a single string in the form `From TASK-001 to TASK-029` using the first and last task IDs you find.
   - `priority`: copy the priority from the first story in the original file.
   - `passes`: `true` (hardcoded).
   - `notes`: `Don't repeat task ids when starting the next one.` (exact text).
3. Update `.wile/progress.txt`:
   - Keep the header `# Wile Progress Log` and `## Codebase Patterns`.
   - Add bullet points at the top under `## Codebase Patterns` for any important learnings that would help future agents.
   - Replace the rest of the log with a short, high-level summary in a few paragraphs.
   - Do not lose important info, but avoid detailed step-by-step logs.
   - Ignore preflight failures in the history.

Response format:
- Your response must end with a single-line JSON object and nothing after it (no trailing text).
- The final non-empty line of output must be valid JSON exactly matching this shape:
  {
    "id": "GROUP-001",
    "title": "summary of everything done here",
    "tasks": [
      "High level of what was accomplished here",
      "Should NOT have all tasks in here, should be very summarized"
    ],
    "taskIds": "From TASK-001 to TASK-029",
    "priority": 1,
    "passes": true,
    "notes": "Don't repeat task ids when starting the next one."
  }
- Do not wrap the JSON in code fences.
- Ensure nothing appears after the JSON line.
