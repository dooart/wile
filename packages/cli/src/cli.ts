#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runConfig } from "./commands/config";
import { runWile } from "./commands/run";

const packageJsonPath = resolve(new URL("../package.json", import.meta.url).pathname);
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

const program = new Command();

program
  .name("wile")
  .description("Autonomous AI coding agent that ships features while you sleep")
  .version(packageJson.version);

program
  .command("config")
  .description("Configure the current project for Wile")
  .action(async () => {
    await runConfig();
  });

program
  .command("run")
  .description("Run Wile on a repository")
  .requiredOption("--branch <branch>", "Branch to work on")
  .option("--repo <repo>", "Repository URL or local path")
  .option("--max-iterations <count>", "Maximum iterations", "25")
  .option("--test", "Run in test mode")
  .action((options: { branch: string; repo?: string; maxIterations: string; test?: boolean }) => {
    runWile(options);
  });

program.parse(process.argv);
