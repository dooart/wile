# Wile

Monorepo for the Wile CLI and agent.

## Docs

- `packages/cli/README.md` for CLI usage and publishing.
- `packages/agent/README.md` for agent usage and configuration.

## Acknowledgements

This project was inspired by [ralph](https://github.com/snarktank/ralph).

## Tests

- `./scripts/test-local.sh` for config flow tests and Docker test-mode integration.
- `./scripts/test-full.sh` for the full GitHub + Claude Code integration run.

Test scripts read credentials from `.wile/secrets/.env.test`.
