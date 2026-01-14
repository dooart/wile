# wile CLI

Autonomous AI coding agent that ships features while you sleep.

## Install

```bash
bunx wile --help
```

## Configure a project

From your project repo:

```bash
bunx wile config
```

This creates:

- `.wile/secrets/.env` for required credentials
- `.wile/.env.project` for env vars forwarded into the container (or set `WILE_ENV_PROJECT_PATH`)
- `.wile/.gitignore` to ignore `secrets/`, `screenshots/`, and `logs/`
- `.wile/prd.json` (empty) and `.wile/prd.json.example`

Set `WILE_REPO_SOURCE=local` in `.wile/secrets/.env` to run against the current directory without GitHub.
When `WILE_REPO_SOURCE=local`, GitHub credentials are optional.
Set `WILE_MAX_ITERATIONS` in `.wile/secrets/.env` to change the default loop limit (default: 25).
Set `CODING_AGENT=OC` to use OpenCode (OpenRouter), `CODING_AGENT=GC` to use Gemini CLI, otherwise `CODING_AGENT=CC` uses Claude Code.

## Run Wile

```bash
bunx wile run
```

Optional flags:

- `--repo <url-or-path>`: override repo URL
- `--max-iterations <count>`: default 25
- `--test`: run the mocked agent in Docker without GitHub/Claude

## Logs

Each run writes a session log to `.wile/logs/run-YYYYMMDD_HHMMSS.log`.

## Publish

Release (bump version + build):

```bash
./scripts/release-cli.sh patch
```

Publish:

```bash
./scripts/publish-cli.sh
```
