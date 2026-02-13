# Wile Preflight (Iteration 0)

You are running the preflight phase for a Wile autonomous coding session.

## Environment

Env vars are injected at runtime (no `.env` file). To check if a var is set:

```bash
[ -n "$VAR_NAME" ] && echo "ok" || echo "missing"
```

## Tasks

1. Verify `.wile/prd.json` exists and is valid JSON:

```bash
cat .wile/prd.json
```

2. If `.wile/preflight.md` does **not** exist, do nothing else. Do not modify files and do not print extra output.

3. If `.wile/preflight.md` exists, read it and follow the checks exactly, in order. Run any commands listed in code blocks. If it describes a check without a command, perform the check and note the result.

4. If **any** check fails or cannot be completed:
   - Append a new entry to `.wile/progress.txt` describing what failed and why, using this format:

```markdown
---

## [DATE] - PREFLIGHT FAILED

**Checks run:**
- ...

**Failures:**
- ...
```
   - Under **Checks run**, include the exact command(s) you executed (verbatim).
   - Under **Failures**, include the specific missing file names or failing commands.

   - Respond with exactly:

```
<promise>PREFLIGHT_FAILED</promise>
```

The entire response must be exactly that single line. No other text before or after. No extra lines. No markdown. No backticks. No code blocks.

5. If all checks pass, respond with exactly:
```
<promise>PREFLIGHT_SUCCEEDED</promise>
```
The entire response must be exactly that single line. No other text before or after. No extra lines. No markdown. No backticks. No code blocks.

## Strict Output Rules

- Output must contain exactly one promise tag.
- Never repeat the promise tag on the same line or across multiple lines.
- Never include any other text before or after the promise tag.

## Notes

- Preflight may have side effects if the checks require them.
- Do not change any files unless a failure must be recorded in `.wile/progress.txt`.
