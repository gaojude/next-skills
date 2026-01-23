import { Command } from "commander";
import prompts from "prompts";
import chalk from "chalk";
import { runExperimentalClaudeMd } from "./commands/experimental-claude-md.js";
import { getNextjsVersion } from "./version/nextjs.js";

interface CliOptions {
  version?: string;
  md?: string;
}

async function promptForOptions(cwd: string): Promise<{ nextVersion: string; agentsMdFile: string }> {
  // Detect Next.js version for default
  const versionResult = getNextjsVersion(cwd);
  const detectedVersion = versionResult.version;

  console.log(chalk.cyan("\n📚 next-agents-md - Next.js Documentation for AI Agents\n"));

  if (detectedVersion) {
    console.log(chalk.gray(`   Detected Next.js version: ${detectedVersion}\n`));
  }

  const response = await prompts([
    {
      type: "text",
      name: "nextVersion",
      message: "Next.js version",
      initial: detectedVersion || "",
      validate: (value: string) =>
        value.trim() ? true : "Please enter a Next.js version",
    },
    {
      type: "select",
      name: "agentsMdFile",
      message: "Target markdown file",
      choices: [
        { title: "CLAUDE.md", value: "CLAUDE.md" },
        { title: "AGENTS.md", value: "AGENTS.md" },
        { title: "Custom...", value: "__custom__" },
      ],
      initial: 0,
    },
  ]);

  // Handle cancelled prompts
  if (response.nextVersion === undefined || response.agentsMdFile === undefined) {
    console.log(chalk.yellow("\nCancelled."));
    process.exit(0);
  }

  let agentsMdFile = response.agentsMdFile;

  if (agentsMdFile === "__custom__") {
    const customResponse = await prompts({
      type: "text",
      name: "customFile",
      message: "Enter custom file path",
      initial: "CLAUDE.md",
      validate: (value: string) =>
        value.trim() ? true : "Please enter a file path",
    });

    if (customResponse.customFile === undefined) {
      console.log(chalk.yellow("\nCancelled."));
      process.exit(0);
    }

    agentsMdFile = customResponse.customFile;
  }

  return {
    nextVersion: response.nextVersion,
    agentsMdFile,
  };
}

export async function run(): Promise<void> {
  const program = new Command();

  program
    .name("next-agents-md")
    .description("Generate a documentation index for Claude/Agents files")
    .option("--version <version>", "Next.js version")
    .option("--md <path>", "Target markdown file (default: CLAUDE.md)")
    .action(async (options: CliOptions) => {
      const cwd = process.cwd();

      // Case 1: If --version is provided, use it
      if (options.version) {
        const outputFile = options.md || "CLAUDE.md";
        await runExperimentalClaudeMd({
          nextjsVersion: options.version,
          outputFile,
        });
        return;
      }

      // Case 2: If --md is provided, try to detect version
      if (options.md) {
        const detected = getNextjsVersion(cwd);
        if (detected.version) {
          // Version found, run non-interactively
          await runExperimentalClaudeMd({
            nextjsVersion: detected.version,
            outputFile: options.md,
          });
          return;
        }
        // Version not found, show error and exit
        console.error(
          chalk.red(
            "\n❌ Could not detect Next.js version. Please use --version to specify the version.\n"
          )
        );
        process.exit(1);
      }

      // Case 3: No flags specified, enter interactive mode
      const promptedOptions = await promptForOptions(cwd);

      await runExperimentalClaudeMd({
        nextjsVersion: promptedOptions.nextVersion,
        outputFile: promptedOptions.agentsMdFile,
      });
    });

  await program.parseAsync();
}
