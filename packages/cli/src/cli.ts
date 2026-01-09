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
  .option("--repo <repo>", "Repository URL or local path")
  .option("--max-iterations <count>", "Maximum iterations")
  .option("--test", "Run in test mode")
  .option("--debug", "Print debug info before running")
  .action(
    async (options: { repo?: string; maxIterations: string; test?: boolean; debug?: boolean }) => {
      await runWile(options);
    });

program.parse(process.argv);
