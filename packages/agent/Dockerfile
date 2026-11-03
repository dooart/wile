FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install base dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    gnupg \
    unzip \
    build-essential \
    software-properties-common \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Bun to /usr/local (globally accessible)
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

# Install agent-browser via bun (postinstall handled manually)
RUN mkdir -p /opt/agent-browser \
    && cat > /opt/agent-browser/package.json <<'JSON'
{
  "name": "agent-browser-install",
  "private": true,
  "overrides": { "playwright-core": "1.64.1" }
}
JSON
RUN cd /opt/agent-browser \
    && bun add --exact agent-browser@0.17.1 playwright@1.64.1 \
    && node /opt/agent-browser/node_modules/agent-browser/scripts/postinstall.js \
    && ln -s /home/wile/scripts/agent-browser-safe.sh /usr/local/bin/agent-browser

# Create non-root user
RUN useradd -m -s /bin/bash wile \
    && mkdir -p /home/wile/workspace \
    && ln -s /opt/agent-browser/node_modules /home/wile/node_modules \
    && chown -R wile:wile /home/wile

# Memory optimization settings per Claude Code specs
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Note: The following settings must be configured on the HOST (EC2 instance), not in Docker:
# - Swap (8GB): fallocate -l 8G /swapfile && mkswap /swapfile && swapon /swapfile
# - zswap with lz4: echo lz4 > /sys/module/zswap/parameters/compressor && echo 1 > /sys/module/zswap/parameters/enabled
# - vm.swappiness=10: sysctl -w vm.swappiness=10
# - earlyoom: apt install earlyoom && systemctl enable earlyoom
# See packages/agent/scripts/host-setup.sh for EC2 bootstrap

# Install Claude Code CLI
# https://www.npmjs.com/package/@anthropic-ai/claude-code
RUN npm install -g @anthropic-ai/claude-code

# Install OpenCode CLI
# https://www.npmjs.com/package/opencode-ai
RUN npm install -g opencode-ai@latest

# Install Gemini CLI
# https://www.npmjs.com/package/@google/gemini-cli
RUN npm install -g @google/gemini-cli

# Install Codex CLI
# https://www.npmjs.com/package/@openai/codex
RUN npm install -g @openai/codex

# CC_ANTHROPIC_API_KEY is passed at runtime via environment variable (mapped to ANTHROPIC_API_KEY in entrypoint)
# Usage: claude --dangerously-skip-permissions

# Trusted local test browser only. Open-web automation uses a separate isolated CDP browser.
RUN node /opt/agent-browser/node_modules/playwright/cli.js install --with-deps chrome \
    && google-chrome --version

# Copy scripts
COPY scripts/ /home/wile/scripts/
COPY entrypoint.sh /home/wile/entrypoint.sh

RUN chmod +x /home/wile/entrypoint.sh \
    && chmod +x /home/wile/scripts/*.sh 2>/dev/null || true \
    && chown -R wile:wile /home/wile

# Working directory
WORKDIR /home/wile/workspace

# Switch to non-root user
USER wile

# Default command
ENTRYPOINT ["/home/wile/entrypoint.sh"]
