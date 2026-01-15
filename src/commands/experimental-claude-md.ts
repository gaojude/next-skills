import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { pullDocs } from "./pull.js";
import { collectDocFiles, buildDocTree } from "../generator/git.js";
import {
  generateClaudeMdIndex,
  injectIntoClaudeMd,
  hasExistingIndex,
} from "../generator/claude-md.js";

export interface ExperimentalClaudeMdOptions {
  nextjsVersion?: string;
}

/**
 * Run the experimental CLAUDE.md mode.
 * This pulls docs to /tmp and injects a documentation index into CLAUDE.md.
 */
export async function runExperimentalClaudeMd(
  options: ExperimentalClaudeMdOptions
): Promise<void> {
  const cwd = process.cwd();
  const claudeMdPath = join(cwd, "CLAUDE.md");

  console.log(
    chalk.cyan("\n🧪 Running experimental CLAUDE.md mode...\n")
  );

  // Step 1: Pull docs to /tmp
  const spinner = ora("Pulling documentation from GitHub...").start();

  const pullResult = await pullDocs({
    cwd,
    version: options.nextjsVersion,
  });

  if (!pullResult.success) {
    spinner.fail(chalk.red(`Failed to pull docs: ${pullResult.error}`));
    process.exit(1);
  }

  spinner.succeed(chalk.green("Documentation pulled"));
  console.log(chalk.gray(`   Path: ${pullResult.docsPath}`));
  console.log(chalk.gray(`   Version: ${pullResult.nextjsVersion}\n`));

  // Step 2: Build documentation tree
  const indexSpinner = ora("Building documentation index...").start();

  const docFiles = collectDocFiles(pullResult.docsPath!);
  const sections = buildDocTree(docFiles);

  // Step 3: Generate the index content
  const indexContent = generateClaudeMdIndex({
    libVersion: pullResult.nextjsVersion!,
    docsPath: pullResult.docsPath!,
    sections,
  });

  indexSpinner.succeed(chalk.green("Documentation index generated"));
  console.log(chalk.gray(`   Indexed ${docFiles.length} documentation files\n`));

  // Step 4: Inject into CLAUDE.md
  const injectSpinner = ora("Injecting into CLAUDE.md...").start();

  let existingContent = "";
  let isNewFile = true;

  if (existsSync(claudeMdPath)) {
    existingContent = readFileSync(claudeMdPath, "utf-8");
    isNewFile = false;
  }

  const newContent = injectIntoClaudeMd(existingContent, indexContent);
  writeFileSync(claudeMdPath, newContent, "utf-8");

  if (isNewFile) {
    injectSpinner.succeed(chalk.green("Created CLAUDE.md with documentation index"));
  } else if (hasExistingIndex(existingContent)) {
    injectSpinner.succeed(chalk.green("Updated existing documentation index in CLAUDE.md"));
  } else {
    injectSpinner.succeed(chalk.green("Appended documentation index to CLAUDE.md"));
  }

  // Summary
  console.log(chalk.cyan("\n📋 Summary:\n"));
  console.log(`   ${chalk.gray("Documentation path:")} ${pullResult.docsPath}`);
  console.log(`   ${chalk.gray("CLAUDE.md path:")} ${claudeMdPath}`);
  console.log(`   ${chalk.gray("Next.js version:")} ${pullResult.nextjsVersion}`);
  console.log(`   ${chalk.gray("Files indexed:")} ${docFiles.length}`);
  console.log("");

  console.log(chalk.yellow("⚠️  Note: The documentation is in a temporary directory."));
  console.log(chalk.yellow("   It may be cleaned up when you restart your system."));
  console.log(chalk.yellow("   Re-run this command to refresh the docs.\n"));

  console.log(chalk.green("✨ Done! Your CLAUDE.md now includes the Next.js documentation index.\n"));
}
