FROM node:22-bookworm-slim
ARG BROWSER_REFRESH
RUN echo "$BROWSER_REFRESH" >/dev/null && apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home browser
WORKDIR /opt/browser
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY server.mjs ./
ENV HOME=/home/browser CHROME_EXECUTABLE_PATH=/usr/bin/chromium
USER 10001:10001
HEALTHCHECK --interval=2s --timeout=3s --start-period=30s --retries=15 CMD node -e "fetch('http://127.0.0.1:9222/json/version').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
