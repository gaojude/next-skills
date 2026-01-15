import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import chalk from "chalk";
import ora from "ora";
import { getNextjsVersion } from "../version/nextjs.js";
import { versionToGitHubTag } from "../version/release.js";
import { cloneDocsFolder } from "../generator/git.js";
import { generateSessionId, trackPull } from "../telemetry/index.js";

export interface PullOptions {
  cwd: string;
  version?: string; // Override Next.js version
}

export interface PullResult {
  success: boolean;
  docsPath?: string;
  sessionId?: string;
  nextjsVersion?: string;
  error?: string;
}

/**
 * Pull Next.js documentation to a temporary directory.
 * This is the lazy-loading entry point that agents must call.
 */
export async function pullDocs(options: PullOptions): Promise<PullResult> {
  const { cwd, version: versionOverride } = options;

  // Detect Next.js version
  let nextjsVersion: string;

  if (versionOverride) {
    nextjsVersion = versionOverride;
  } else {
    const versionResult = getNextjsVersion(cwd);
    if (!versionResult.version) {
      return {
        success: false,
        error: versionResult.error || "Could not detect Next.js version",
      };
    }
    nextjsVersion = versionResult.version;
  }

  // Generate session ID for this pull
  const sessionId = generateSessionId();

  // Create temp directory for this session
  const docsPath = join(tmpdir(), `next-skills-${sessionId}`);

  try {
    // Clean up if exists (shouldn't happen with unique session ID, but just in case)
    if (existsSync(docsPath)) {
      rmSync(docsPath, { recursive: true });
    }
    mkdirSync(docsPath, { recursive: true });

    // Clone docs from GitHub
    const tag = versionToGitHubTag(nextjsVersion);
    await cloneDocsFolder(tag, docsPath);

    // Send telemetry
    trackPull(nextjsVersion, sessionId);

    return {
      success: true,
      docsPath,
      sessionId,
      nextjsVersion,
    };
  } catch (error) {
    // Clean up on failure
    if (existsSync(docsPath)) {
      rmSync(docsPath, { recursive: true });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * CLI handler for the pull command.
 */
export async function runPullCommand(versionOverride?: string): Promise<void> {
  const cwd = process.cwd();

  // Show what we're doing
  if (versionOverride) {
    console.log(chalk.cyan(`\n📚 Pulling Next.js v${versionOverride} documentation...\n`));
  } else {
    console.log(chalk.cyan("\n📚 Pulling Next.js documentation...\n"));
  }

  const spinner = ora("Fetching documentation from GitHub...").start();

  const result = await pullDocs({ cwd, version: versionOverride });

  if (!result.success) {
    spinner.fail(chalk.red(`Failed to pull docs: ${result.error}`));
    process.exit(1);
  }

  spinner.succeed(chalk.green("Documentation ready"));

  // Output the path prominently - this is what agents need
  console.log(chalk.cyan("\n📂 Documentation path:\n"));
  console.log(`   ${result.docsPath}\n`);

  console.log(chalk.gray(`   Next.js version: ${result.nextjsVersion}`));
  console.log(chalk.gray(`   Session ID: ${result.sessionId}\n`));

  // Help the agent understand what to do next
  console.log(chalk.yellow("You can now search and read files in this directory."));
  console.log(chalk.yellow("Example: grep -r 'caching' " + result.docsPath + "\n"));
}
