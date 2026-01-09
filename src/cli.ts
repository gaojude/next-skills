import { Command } from "commander";
import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import { getNextjsVersion } from "./version/nextjs.js";
import { getOwnPackageVersion } from "./version/meta.js";
import { AGENTS, AGENT_IDS } from "./agents/index.js";
import { detectInstalledAgents } from "./agents/detect.js";
import {
  installSkill,
  detectExistingInstallation,
  needsUpdate,
} from "./installer/index.js";
import type { AgentId } from "./agents/types.js";

export async function run(): Promise<void> {
  const program = new Command();

  program
    .name("next-skills")
    .description(
      "Install Next.js documentation as an Agent Skill for AI coding agents"
    )
    .version(getOwnPackageVersion())
    .option(
      "-a, --agent <agents...>",
      "Specify agent(s) to install for (claude, gemini, copilot, cursor, opencode)"
    )
    .option("-f, --force", "Force reinstall even if already up to date")
    .option("-s, --sync", "Sync/update existing installation to latest")
    .parse();

  const options = program.opts<{
    agent?: string[];
    force?: boolean;
    sync?: boolean;
  }>();

  const cwd = process.cwd();

  // Step 1: Check for Next.js version
  console.log(chalk.cyan("\n📦 Checking Next.js version...\n"));

  const nextjsResult = getNextjsVersion(cwd);
  if (!nextjsResult.version) {
    console.error(chalk.red(`❌ ${nextjsResult.error}`));
    process.exit(1);
  }

  console.log(chalk.green(`   Found Next.js v${nextjsResult.version}`));

  // Step 2: Check existing installation
  const existingInstall = detectExistingInstallation(cwd);
  const skillVersion = getOwnPackageVersion();

  if (existingInstall.installed && existingInstall.meta) {
    const updateCheck = needsUpdate(
      existingInstall.meta,
      nextjsResult.version,
      skillVersion
    );

    if (!updateCheck.needsUpdate && !options.force && !options.sync) {
      console.log(
        chalk.green(
          `\n✅ Skill already installed and up to date (v${existingInstall.meta.libVersion})`
        )
      );
      console.log(
        chalk.gray(
          `   Installed for: ${existingInstall.meta.agents.map((a) => AGENTS[a].name).join(", ")}`
        )
      );
      console.log(
        chalk.gray(`   Use --force to reinstall or --sync to update\n`)
      );
      return;
    }

    if (updateCheck.needsUpdate) {
      console.log(chalk.yellow(`\n⚠️  ${updateCheck.reason}`));
    }
  }

  // Step 3: Detect or prompt for agents
  let selectedAgents: AgentId[];

  if (options.agent && options.agent.length > 0) {
    // Validate provided agents
    const invalidAgents = options.agent.filter(
      (a) => !AGENT_IDS.includes(a as AgentId)
    );
    if (invalidAgents.length > 0) {
      console.error(
        chalk.red(`❌ Invalid agent(s): ${invalidAgents.join(", ")}`)
      );
      console.error(
        chalk.gray(`   Valid agents: ${AGENT_IDS.join(", ")}`)
      );
      process.exit(1);
    }
    selectedAgents = options.agent as AgentId[];
  } else {
    // Auto-detect and prompt
    const detectedAgents = detectInstalledAgents(cwd);

    console.log(chalk.cyan("\n🔍 Select AI agents to install for:\n"));

    const response = await prompts({
      type: "multiselect",
      name: "agents",
      message: "Which agents should have the Next.js skill?",
      choices: AGENT_IDS.map((id) => ({
        title: AGENTS[id].name,
        value: id,
        selected: detectedAgents.includes(id),
      })),
      min: 1,
      hint: "- Space to select. Return to submit",
    });

    if (!response.agents || response.agents.length === 0) {
      console.log(chalk.yellow("\n⚠️  No agents selected. Exiting.\n"));
      return;
    }

    selectedAgents = response.agents as AgentId[];
  }

  console.log(
    chalk.cyan(
      `\n📥 Installing for: ${selectedAgents.map((a) => AGENTS[a].name).join(", ")}\n`
    )
  );

  // Step 4: Generate and install
  const spinner = ora("Cloning Next.js documentation...").start();

  try {
    const result = await installSkill({
      cwd,
      nextjsVersion: nextjsResult.version,
      agents: selectedAgents,
    });

    if (!result.success) {
      spinner.fail(chalk.red(`Installation failed: ${result.error}`));
      process.exit(1);
    }

    spinner.succeed(chalk.green("Documentation installed"));

    // Report results
    console.log(chalk.cyan("\n📋 Installation Summary:\n"));
    console.log(`   ${chalk.gray("Next.js version:")} ${result.libVersion}`);
    console.log(`   ${chalk.gray("Skill version:")} ${result.skillVersion}`);
    console.log("");

    for (const agentResult of result.agentResults) {
      const agent = AGENTS[agentResult.agentId];
      if (agentResult.success) {
        const note = agentResult.isPrimary
          ? chalk.gray(" (primary)")
          : agentResult.usedCopy
            ? chalk.yellow(" (copied)")
            : chalk.gray(" (symlink)");
        console.log(chalk.green(`   ✓ ${agent.name}`) + note);
        console.log(chalk.gray(`     ${agentResult.path}`));
      } else {
        console.log(chalk.red(`   ✗ ${agent.name}: ${agentResult.error}`));
      }
    }

    console.log(chalk.green("\n✨ Done! The Next.js skill is now available.\n"));
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}
