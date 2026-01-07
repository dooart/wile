# Berserk Setup (Iteration 0)

You are running the setup phase for a Berserk autonomous coding session. Your job is to ensure the project is properly configured before the main loop begins.

## Tasks (Execute in Order)

### 1. Verify .berserk/prd.json exists

```bash
cat .berserk/prd.json
```

If this file doesn't exist, respond with `<promise>SETUP_FAILED</promise>` - the project is not configured for Berserk.

### 2. Set up .gitignore (if needed)

Check if .gitignore exists and has standard ignores. If not, create/update it:

```bash
# Check if .gitignore exists and has node_modules
if ! grep -q "node_modules" .gitignore 2>/dev/null; then
  cat >> .gitignore << 'GITIGNORE'

# Dependencies
node_modules/
.pnp/
.pnp.js

# Build outputs
dist/
build/
.next/
out/

# Environment files
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Python
__pycache__/
*.py[cod]
*$py.class
.Python
venv/
.venv/
env/
.egg-info/
*.egg

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
.nyc_output/
GITIGNORE
fi
```

If you created or modified .gitignore, commit and push:
```bash
git add .gitignore
git commit -m "chore: set up .gitignore"
git push
```

### 3. Initialize .berserk/progress.txt (if needed)

If `.berserk/progress.txt` doesn't exist, create it:

```bash
if [ ! -f ".berserk/progress.txt" ]; then
  cat > .berserk/progress.txt << 'EOF'
# Berserk Progress Log

## Codebase Patterns
(Learnings will be added here as patterns are discovered)

---

EOF
  git add .berserk/progress.txt
  git commit -m "chore: initialize berserk progress log"
  git push
fi
```

### 4. Compress old progress entries (if needed)

Check if progress.txt is getting too long (over 500 lines). If so, summarize old entries:

```bash
LINE_COUNT=$(wc -l < .berserk/progress.txt)
if [ "$LINE_COUNT" -gt 500 ]; then
  echo "Progress log has $LINE_COUNT lines - compression needed"
  # TODO: Implement compression logic
  # For now, just note it in the log
fi
```

**Future enhancement:** When progress.txt exceeds 500 lines, compress older iteration logs into a summary while keeping the Codebase Patterns section and recent entries intact.

### 5. Validate prd.json structure

Read and validate the PRD structure:
- Must have `userStories` array
- Each story must have: `id`, `title`, `acceptanceCriteria`, `priority`, `passes`

If the structure is invalid, log a warning but continue.

### 6. Report setup status

After completing all setup tasks, end your response normally. The main loop will begin.

**Do NOT output `<promise>COMPLETE</promise>`** - that's only for when ALL stories are done.

### 6. Ensure screenshots are gitignored

Screenshots are temporary verification artifacts and should not be tracked:

```bash
if ! grep -q "^\.berserk/screenshots/$" .gitignore 2>/dev/null; then
  echo ".berserk/screenshots/" >> .gitignore
  git add .gitignore
  git commit -m "chore: gitignore .berserk/screenshots"
  git push
fi
```

## Important Notes

- The .berserk/ folder IS tracked in git (except screenshots/)
- .berserk/prd.json contains the user stories (Product Requirements Document)
- .berserk/progress.txt contains learnings and iteration logs
- .berserk/screenshots/ stores visual verification screenshots (gitignored)

## Failure Conditions

Only respond with `<promise>SETUP_FAILED</promise>` if:
- .berserk/prd.json does not exist
- .berserk/prd.json is not valid JSON
- Git operations fail critically (can't commit/push)
