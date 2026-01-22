import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getNextjsVersion } from "../version/nextjs.js";
import { versionToGitHubTag } from "../version/release.js";
import { cloneDocsFolder } from "./git.js";

export interface PullOptions {
  cwd: string;
  version?: string; // Override Next.js version
  docsDir?: string; // Override destination directory
}

export interface PullResult {
  success: boolean;
  docsPath?: string;
  nextjsVersion?: string;
  error?: string;
}

/**
 * Pull Next.js documentation to a local directory (temporary by default).
 */
export async function pullDocs(options: PullOptions): Promise<PullResult> {
  const { cwd, version: versionOverride, docsDir } = options;

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

  const docsPath = docsDir ?? mkdtempSync(join(tmpdir(), "next-skills-"));
  const useTempDir = !docsDir;

  try {
    // Clean up if exists (shouldn't happen with unique session ID, but just in case)
    if (useTempDir && existsSync(docsPath)) {
      rmSync(docsPath, { recursive: true });
    }

    // Clone docs from GitHub
    const tag = versionToGitHubTag(nextjsVersion);
    await cloneDocsFolder(tag, docsPath);

    return {
      success: true,
      docsPath,
      nextjsVersion,
    };
  } catch (error) {
    // Clean up on failure
    if (useTempDir && existsSync(docsPath)) {
      rmSync(docsPath, { recursive: true });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
