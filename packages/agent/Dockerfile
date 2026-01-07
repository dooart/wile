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
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Bun to /usr/local (globally accessible)
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr/local bash

# Install Python 3.11
RUN add-apt-repository ppa:deadsnakes/ppa -y \
    && apt-get update \
    && apt-get install -y python3.11 python3.11-venv python3-pip \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -s /bin/bash berserk \
    && mkdir -p /home/berserk/workspace \
    && chown -R berserk:berserk /home/berserk

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

# CC_ANTHROPIC_API_KEY is passed at runtime via environment variable (mapped to ANTHROPIC_API_KEY in entrypoint)
# Usage: claude --dangerously-skip-permissions

# Install Playwright with Chromium for browser testing
# Dependencies for headless Chromium
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright globally and download Chromium to shared location
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers
RUN npm install -g playwright \
    && mkdir -p /opt/playwright-browsers \
    && npx playwright install chromium \
    && chmod -R 755 /opt/playwright-browsers

# Copy scripts
COPY scripts/ /home/berserk/scripts/
COPY entrypoint.sh /home/berserk/entrypoint.sh

RUN chmod +x /home/berserk/entrypoint.sh \
    && chmod +x /home/berserk/scripts/*.sh 2>/dev/null || true \
    && chown -R berserk:berserk /home/berserk

# Working directory
WORKDIR /home/berserk/workspace

# Switch to non-root user
USER berserk

# Default command
ENTRYPOINT ["/home/berserk/entrypoint.sh"]
