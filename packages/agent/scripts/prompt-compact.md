You are running a one-shot compaction task.

Goal: compact both `.wile/prd.json` and `.wile/progress.txt` while preserving correctness.

Rules:
- Final `.wile/prd.json` must stay valid under the current schema (`stories`, numeric `id`, `dependsOn`, `status`).
- Never reuse a compacted story ID. Any ID listed in any `compactedFrom` is permanently reserved.
- `compactedFrom` must use canonical range-string syntax like `1..3,5` (sorted, non-overlapping, merged).
- Keep every pending story exactly as-is.
- Do not create missing dependencies.

Steps:
1. Read `.wile/prd.json` and `.wile/progress.txt`.
2. Compute:
   - `pendingStories`: all stories where `status` is `"pending"`
   - `doneStories`: all stories where `status` is `"done"`
   - `requiredDoneIds`: every done-story id referenced by any pending story `dependsOn`
3. Build a compacted `stories` array:
   - Keep all `pendingStories` exactly as-is.
   - Keep all done stories whose id is in `requiredDoneIds` exactly as-is.
   - For remaining done stories, replace them with one summary done story:
     - `id`: next available integer id greater than every story `id` and every id covered by any `compactedFrom` ranges
     - `title`: `[COMPACT] Completed stories summary`
     - `description`: concise summary of shipped work
     - `acceptanceCriteria`: a short list (1-3 bullets) describing what was completed
     - `dependsOn`: []
     - `compactedFrom`: canonical range-string of all compacted story IDs (example: `1..3,5`)
       - Include each replaced done story `id`
       - If a replaced story already has `compactedFrom`, include those IDs too (preserve tombstones transitively)
     - `status`: `"done"`
   - Preserve stable ordering as much as possible: keep retained stories in original order and append the summary story at the end.
4. Update `.wile/progress.txt`:
   - Keep header `# Wile Progress Log` and `## Codebase Patterns`.
   - Add useful high-level bullets under `## Codebase Patterns`.
   - Replace verbose history with a concise high-level summary.
   - Ignore preflight-failure noise.
5. When committing changes, only `.wile/prd.json` and `.wile/progress.txt` should be committed.

Response format:
- Your response must end with a single-line JSON object and nothing after it.
- The final non-empty line must be valid JSON with this shape:
  {
    "summaryStoryId": 123,
    "summaryTitle": "[COMPACT] Completed stories summary"
  }
- Do not wrap JSON in code fences.
- Ensure nothing appears after the JSON line.
