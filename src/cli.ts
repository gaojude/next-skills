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
  uninstallSkill,
  detectExistingInstallation,
  needsUpdate,
  getInstalledAgents,
  removeSkillFromAgent,
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
    .option("-c, --config", "Modify agent selection")
    .parse();

  const options = program.opts<{ config?: boolean }>();
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
  const installedAgents = getInstalledAgents(cwd);
  const detectedAgents = detectInstalledAgents(cwd);

  let selectedAgents: AgentId[];
  let agentsToRemove: AgentId[] = [];

  // Helper to show agent selection prompt
  async function promptForAgents(preSelected: AgentId[]): Promise<AgentId[] | null> {
    console.log(chalk.cyan("\n🔍 Select AI agents to install for:\n"));

    const response = await prompts({
      type: "multiselect",
      name: "agents",
      message: "Which agents should have the Next.js skill?",
      choices: AGENT_IDS.map((id) => ({
        title: AGENTS[id].name,
        value: id,
        selected: preSelected.includes(id),
      })),
      hint: "- Space to select. Return to submit",
    });

    if (!response.agents) {
      return null;
    }
    return response.agents as AgentId[];
  }

  if (existingInstall.installed && existingInstall.meta) {
    // Skill is installed
    const updateCheck = needsUpdate(
      existingInstall.meta,
      nextjsResult.version,
      skillVersion
    );

    if (options.config) {
      // User wants to modify agent selection
      const newSelection = await promptForAgents(installedAgents);
      if (!newSelection) {
        console.log(chalk.yellow("\n⚠️  Cancelled. Exiting.\n"));
        return;
      }

      if (newSelection.length === 0) {
        // Uninstall from all agents
        uninstallSkill(cwd, installedAgents);
        const removedNames = installedAgents.map((a) => AGENTS[a].name);
        console.log(
          chalk.yellow(`\n🗑️  Uninstalled from: ${removedNames.join(", ")}\n`)
        );
        return;
      }

      selectedAgents = newSelection;
      // Find agents to remove (were installed but now deselected)
      agentsToRemove = installedAgents.filter((a) => !newSelection.includes(a));
    } else if (!updateCheck.needsUpdate) {
      // Up to date - show status and hint
      const installedNames = installedAgents.map((a) => AGENTS[a].name);
      const otherAgents = AGENT_IDS.filter((a) => !installedAgents.includes(a));
      const otherNames = otherAgents.map((a) => AGENTS[a].name);

      console.log(
        chalk.green(
          `\n✅ Skill already installed and up to date (v${existingInstall.meta.libVersion})`
        )
      );
      console.log(chalk.gray(`   Installed for: ${installedNames.join(", ")}`));
      if (otherNames.length > 0) {
        console.log(
          chalk.gray(`   Also supports: ${otherNames.join(", ")}`)
        );
        console.log(
          chalk.gray(`   Use --config to add or remove\n`)
        );
      } else {
        console.log("");
      }
      return;
    } else {
      // Needs update - auto-update for same agents
      console.log(chalk.yellow(`\n⚠️  ${updateCheck.reason}`));
      selectedAgents = installedAgents;
    }
  } else {
    // First-time install - prompt for agents
    const newSelection = await promptForAgents(detectedAgents);
    if (!newSelection) {
      console.log(chalk.yellow("\n⚠️  Cancelled. Exiting.\n"));
      return;
    }

    if (newSelection.length === 0) {
      console.log(chalk.yellow("\n⚠️  No agents selected. Exiting.\n"));
      return;
    }

    selectedAgents = newSelection;
  }

  // Remove skill from deselected agents
  if (agentsToRemove.length > 0) {
    for (const agentId of agentsToRemove) {
      removeSkillFromAgent(cwd, agentId);
    }
    console.log(
      chalk.yellow(
        `\n🗑️  Removed from: ${agentsToRemove.map((a) => AGENTS[a].name).join(", ")}`
      )
    );
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
