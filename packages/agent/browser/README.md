# Disposable browser for Wile

Run from the Wile repository:

```sh
packages/agent/browser/with-browser.sh bun run packages/cli/src/cli.ts run
```

The wrapper builds a browser-only image, creates a private per-run Docker network, starts the browser, and runs Wile only after browser version and Linux renderer sandbox checks pass. It removes its browser container/network when the command exits. It does not publish an image, deploy infrastructure, create credentials or publish a host port. Docker Desktop/Engine must already be available.

The browser runs as UID 10001 with no added capabilities, a read-only root, temporary RAM-backed profile/storage, no host/project/home mounts, no Docker socket and no agent env files. Only the Wile agent joins its private CDP network. The agent keeps its existing project/credential configuration in a separate container. Treat CDP as privileged and do not publish it or attach another workload to that network. Browser data disappears on teardown. Abrupt host/process failure may require stopping containers with the matching `wile.browser.run` label.

On ARM64 the image uses native Chromium from Debian's security repository rather than an old bundled binary or x86 Chrome emulation. Startup refuses versions below 156.0.8078.79 and verifies PID/user-namespace and Seccomp-BPF sandbox status using only `chrome://sandbox` before exposing CDP. The wrapper refreshes distro browser packages daily; update the minimum baseline and client pins when new browser advisories arrive. There is no `--no-sandbox` fallback. The official Google Chrome trusted-local-test agent image uses linux/amd64 explicitly.

The isolated browser reaches agent-hosted local development servers at `http://wile-agent:PORT`, not its own loopback. The in-agent `browser-test.ts` helper remains limited to trusted loopback tests; use agent-browser through the isolated CDP endpoint for untrusted content. Do not supply authenticated personal profiles or production browser state to this disposable image.

The container seccomp policy is the standard Docker policy plus the namespace syscalls recommended by Playwright, not an unconfined profile. Source: https://raw.githubusercontent.com/microsoft/playwright/v1.64.1/utils/docker/seccomp_profile.json

SHA-256: `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`

Image build success alone does not establish runtime readiness. Until the startup version and sandbox checks pass on the target Docker host, do not claim a verified sandbox or use the service for untrusted browsing. If user instructions exclude running those checks, prepare the image/source and request authorization before activation. Never bypass a failed sandbox check.
