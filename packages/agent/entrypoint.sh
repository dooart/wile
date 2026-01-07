#!/bin/bash
#
# Berserk Container Entrypoint
# Clones repo, sets up workspace, runs the autonomous coding loop
#

set -e

echo "══════════════════════════════════════════════════════"
echo "  🗡️  BERSERK - Container Startup"
echo "══════════════════════════════════════════════════════"

# Required environment variables
: "${GITHUB_REPO_URL:?GITHUB_REPO_URL is required}"
: "${BRANCH_NAME:?BRANCH_NAME is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"

# Authentication: Either CC_CLAUDE_CODE_OAUTH_TOKEN (Pro/Max subscription) or CC_ANTHROPIC_API_KEY (API credits)
if [ -z "$CC_CLAUDE_CODE_OAUTH_TOKEN" ] && [ -z "$CC_ANTHROPIC_API_KEY" ]; then
  echo "ERROR: Either CC_CLAUDE_CODE_OAUTH_TOKEN or CC_ANTHROPIC_API_KEY is required"
  echo ""
  echo "  CC_CLAUDE_CODE_OAUTH_TOKEN - Uses your Pro/Max subscription (recommended)"
  echo "  CC_ANTHROPIC_API_KEY       - Uses API credits (pay per token)"
  echo ""
  echo "Run 'claude setup-token' on your local machine to get an OAuth token."
  exit 1
fi

MAX_ITERATIONS=${MAX_ITERATIONS:-25}
SCRIPT_DIR="/home/berserk/scripts"
WORKSPACE="/home/berserk/workspace"

# Set up Claude Code authentication
if [ -n "$CC_CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "  Auth:       OAuth (Pro/Max subscription)"

  # Create required directories
  mkdir -p ~/.claude ~/.config/claude

  # Create ~/.claude.json (THE CRITICAL FILE!)
  # Without this, Claude Code thinks it's a fresh install and breaks
  cat > ~/.claude.json << 'CLAUDEJSON'
{
  "hasCompletedOnboarding": true,
  "theme": "dark"
}
CLAUDEJSON

  # Create credentials file with the OAuth token
  cat > ~/.claude/.credentials.json << CREDSJSON
{
  "claudeAiOauth": {
    "accessToken": "$CC_CLAUDE_CODE_OAUTH_TOKEN",
    "refreshToken": "$CC_CLAUDE_CODE_OAUTH_TOKEN",
    "expiresAt": 9999999999999,
    "scopes": ["user:inference", "user:profile"]
  }
}
CREDSJSON

  # Copy to alternate location too
  cp ~/.claude/.credentials.json ~/.config/claude/.credentials.json

  # Ensure ANTHROPIC_API_KEY is not set (it overrides OAuth)
  unset ANTHROPIC_API_KEY
else
  echo "  Auth:       API Key (credits)"
  export ANTHROPIC_API_KEY="$CC_ANTHROPIC_API_KEY"
fi

echo "  Repo:       $GITHUB_REPO_URL"
echo "  Branch:     $BRANCH_NAME"
echo "  Iterations: $MAX_ITERATIONS"
echo "══════════════════════════════════════════════════════"
echo ""

# Configure git
echo "Configuring git..."
git config --global user.name "Berserk Bot"
git config --global user.email "berserk@bot.local"
git config --global credential.helper store

# Set up GitHub token authentication
# Extract host from URL (handles both https://github.com/... and git@github.com:...)
if [[ "$GITHUB_REPO_URL" =~ ^https://([^/]+)/ ]]; then
  GIT_HOST="${BASH_REMATCH[1]}"
  # Store credentials for HTTPS
  echo "https://x-access-token:${GITHUB_TOKEN}@${GIT_HOST}" > ~/.git-credentials
elif [[ "$GITHUB_REPO_URL" =~ ^git@([^:]+): ]]; then
  GIT_HOST="${BASH_REMATCH[1]}"
  # Convert to HTTPS for token auth
  GITHUB_REPO_URL=$(echo "$GITHUB_REPO_URL" | sed 's|git@\([^:]*\):|https://\1/|')
  echo "https://x-access-token:${GITHUB_TOKEN}@${GIT_HOST}" > ~/.git-credentials
fi

# Clone the repository
echo "Cloning repository..."
cd "$WORKSPACE"
git clone "$GITHUB_REPO_URL" repo
cd repo

# Checkout the branch
echo "Checking out branch: $BRANCH_NAME"
git fetch origin
if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH_NAME"; then
  git checkout "$BRANCH_NAME"
else
  echo "Branch $BRANCH_NAME does not exist remotely. Creating it..."
  git checkout -b "$BRANCH_NAME"
  git push -u origin "$BRANCH_NAME"
fi

# Verify .berserk/prd.json exists
echo "Checking for .berserk/prd.json..."
if [ ! -f ".berserk/prd.json" ]; then
  echo "ERROR: .berserk/prd.json not found!"
  echo ""
  echo "Your repository must have a .berserk/prd.json file at the root."
  echo "This file contains the user stories for Berserk to implement."
  echo ""
  echo "Example structure:"
  echo '  {'
  echo '    "branchName": "main",'
  echo '    "userStories": ['
  echo '      {'
  echo '        "id": "US-001",'
  echo '        "title": "My feature",'
  echo '        "acceptanceCriteria": ["..."],'
  echo '        "priority": 1,'
  echo '        "passes": false'
  echo '      }'
  echo '    ]'
  echo '  }'
  exit 1
fi

# Set up .berserk/screenshots directory
echo "Setting up .berserk directory..."
mkdir -p .berserk/screenshots

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Starting Berserk Loop"
echo "══════════════════════════════════════════════════════"
echo ""

# Run the main loop
EXIT_CODE=0
"$SCRIPT_DIR/berserk.sh" "$MAX_ITERATIONS" || EXIT_CODE=$?

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Berserk Loop Complete (exit code: $EXIT_CODE)"
echo "══════════════════════════════════════════════════════"

# Handle completion/partial completion
if [ $EXIT_CODE -eq 0 ]; then
  echo "All tasks completed successfully!"
  # Ensure final state is pushed
  git push || true
elif [ $EXIT_CODE -eq 1 ]; then
  echo "Max iterations reached. Committing partial work..."

  # Check if there are uncommitted changes
  if ! git diff --quiet || ! git diff --staged --quiet; then
    git add -A
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    git commit -m "WIP: berserk stopped at max iterations ($TIMESTAMP)

Partial work committed. Check .berserk/progress.txt for details.
Some stories may still have passes=false in .berserk/prd.json."
    git push
  fi
elif [ $EXIT_CODE -eq 2 ]; then
  echo "Setup failed. Check the logs above for details."
else
  echo "Berserk exited with error code: $EXIT_CODE"
  # Try to commit whatever state we have
  if ! git diff --quiet || ! git diff --staged --quiet; then
    git add -A
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    git commit -m "WIP: berserk error exit ($TIMESTAMP)

Exit code: $EXIT_CODE
Check logs for details."
    git push || true
  fi
fi

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Berserk Container Finished"
echo "══════════════════════════════════════════════════════"

exit $EXIT_CODE
