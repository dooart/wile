# PRD authoring guidance for Wile

Wile reads `.wile/prd.json` each iteration, picks the first runnable story in `stories`
where `status: "pending"`, implements exactly one story, marks it `done`, logs
progress, and repeats until all stories are done. The PRD should be written so
each story is independently actionable and verifiable.

Guidelines:
- Use outcome-focused acceptance criteria (observable results).
- Criteria should be hard to satisfy with "empty" tests.
- For integration tests, write acceptance criteria that validate real system behavior (not just the harness).
- If verification is a command, state the expected result of that command.
- Use one behavior per bullet.
- Keep IDs stable, unique, and numeric (e.g., 1, 2, 3).
- Never reuse IDs listed in any story's `compactedFrom` ranges.
- Avoid vague terms like "should" or "nice".
- Keep stories small enough to finish in one iteration.
- Use `status: "pending"` for work not done yet and `status: "done"` only after all acceptance criteria are verified.
- Use `dependsOn` to model prerequisites by story ID.
- `dependsOn` must reference active story IDs only; never reference compacted IDs.
- When compacting completed stories, add a canonical range string like `compactedFrom: "1..3,5"` to the summary done story.
- Prefer concrete files/commands only when they reflect the real outcome.

Environment notes:
- Playwright (Chromium) is available in the agent container for UI checks.
- Project env vars can be passed via `.wile/.env.project` (or override with WILE_ENV_PROJECT_PATH).
- Optional extra guidance can be added in `.wile/additional-instructions.md`.
- The container has outbound internet access by default.
