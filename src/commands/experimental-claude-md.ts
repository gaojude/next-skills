import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { pullDocs } from "../generator/pull.js";
import { collectDocFiles } from "../generator/git.js";
import {
  generateClaudeMdIndex,
  injectIntoClaudeMd,
  hasExistingIndex,
} from "../generator/claude-md.js";
import { versionToGitHubTag } from "../version/release.js";

export interface ExperimentalClaudeMdOptions {
  nextjsVersion?: string;
  outputFile?: string;
}

interface GitignoreStatus {
  path: string;
  updated: boolean;
  alreadyPresent: boolean;
}

const DOCS_DIR_NAME = ".next-docs";
const GITIGNORE_ENTRY = ".next-docs/";

function ensureGitignoreEntry(cwd: string): GitignoreStatus {
  const gitignorePath = join(cwd, ".gitignore");
  const entryRegex = /^\s*\.next-docs(?:\/.*)?\s*$/;

  let content = "";
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, "utf-8");
  }

  const hasEntry = content
    .split(/\r?\n/)
    .some((line) => entryRegex.test(line));

  if (hasEntry) {
    return { path: gitignorePath, updated: false, alreadyPresent: true };
  }

  const needsNewline = content.length > 0 && !content.endsWith("\n");
  const header = content.includes("# next-skills") ? "" : "# next-skills\n";
  const newContent =
    content + (needsNewline ? "\n" : "") + header + `${GITIGNORE_ENTRY}\n`;

  writeFileSync(gitignorePath, newContent, "utf-8");

  return { path: gitignorePath, updated: true, alreadyPresent: false };
}

/**
 * Generate the documentation index.
 * This pulls docs to .next-docs and injects a documentation index into a markdown file.
 */
export async function runExperimentalClaudeMd(
  options: ExperimentalClaudeMdOptions
): Promise<void> {
  const cwd = process.cwd();
  const outputFile = options.outputFile?.trim() || "CLAUDE.md";
  const targetMdPath = isAbsolute(outputFile)
    ? outputFile
    : join(cwd, outputFile);
  const docsPath = join(cwd, DOCS_DIR_NAME);
  const docsLinkPath = `./${DOCS_DIR_NAME}`;

  console.log(
    chalk.cyan(
      `\n📚 Generating documentation index for ${outputFile}...\n`
    )
  );

  // Step 1: Pull docs to .next-docs
  const spinner = ora("Pulling documentation from GitHub...").start();

  const pullResult = await pullDocs({
    cwd,
    version: options.nextjsVersion,
    docsDir: docsPath,
  });

  if (!pullResult.success) {
    spinner.fail(chalk.red(`Failed to pull docs: ${pullResult.error}`));
    process.exit(1);
  }

  spinner.succeed(chalk.green("Documentation pulled"));
  console.log(chalk.gray(`   Path: ${docsPath}`));
  console.log(chalk.gray(`   Version: ${pullResult.nextjsVersion}\n`));

  // Step 2: Collect documentation files
  const indexSpinner = ora("Building documentation index...").start();

  const docFiles = collectDocFiles(docsPath);
  const githubDocsUrl = `https://github.com/vercel/next.js/tree/${versionToGitHubTag(pullResult.nextjsVersion!)}/docs`;

  // Step 3: Generate the index content
  const indexContent = generateClaudeMdIndex({
    docsPath: docsLinkPath,
    files: docFiles,
    githubDocsUrl,
  });

  indexSpinner.succeed(chalk.green("Documentation index generated"));
  console.log(chalk.gray(`   Indexed ${docFiles.length} documentation files\n`));

  // Step 4: Inject into target file
  const injectSpinner = ora(`Injecting into ${outputFile}...`).start();

  let existingContent = "";
  let isNewFile = true;

  if (existsSync(targetMdPath)) {
    existingContent = readFileSync(targetMdPath, "utf-8");
    isNewFile = false;
  }

  const newContent = injectIntoClaudeMd(existingContent, indexContent);
  writeFileSync(targetMdPath, newContent, "utf-8");

  if (isNewFile) {
    injectSpinner.succeed(
      chalk.green(`Created ${outputFile} with documentation index`)
    );
  } else if (hasExistingIndex(existingContent)) {
    injectSpinner.succeed(
      chalk.green(`Updated existing documentation index in ${outputFile}`)
    );
  } else {
    injectSpinner.succeed(
      chalk.green(`Appended documentation index to ${outputFile}`)
    );
  }

  const gitignoreStatus = ensureGitignoreEntry(cwd);

  // Summary
  console.log(chalk.cyan("\n📋 Summary:\n"));
  console.log(`   ${chalk.gray("Documentation path:")} ${docsPath}`);
  console.log(`   ${chalk.gray("Target file path:")} ${targetMdPath}`);
  console.log(`   ${chalk.gray("Next.js version:")} ${pullResult.nextjsVersion}`);
  console.log(`   ${chalk.gray("Files indexed:")} ${docFiles.length}`);
  console.log(`   ${chalk.gray("GitHub docs:")} ${githubDocsUrl}`);
  console.log(
    `   ${chalk.gray(".gitignore:")} ${
      gitignoreStatus.updated
        ? `added ${GITIGNORE_ENTRY}`
        : `${GITIGNORE_ENTRY} already present`
    }`
  );
  console.log("");

  console.log(
    chalk.yellow("ℹ️  Re-run this command to refresh docs after upgrading Next.js.\n")
  );

  console.log(
    chalk.green(
      `✨ Done! ${outputFile} now includes the Next.js documentation index.\n`
    )
  );
}
