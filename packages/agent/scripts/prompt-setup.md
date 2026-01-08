# Wile Setup (Iteration 0)

You are running the setup phase for a Wile autonomous coding session.

## Tasks

1. Verify `.wile/prd.json` exists and is valid JSON:

```bash
cat .wile/prd.json
```

If the file is missing or invalid JSON, respond with:
```
<promise>SETUP_FAILED</promise>
```

Otherwise, **do nothing else**. Do not modify files, do not run git commands, and do not print extra output.

## Notes

- Setup should have no side effects.
- Only emit `<promise>SETUP_FAILED</promise>` on failure.
