import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Clone only the docs folder from Next.js repo using git sparse-checkout.
 * This avoids GitHub API rate limits entirely.
 */
export async function cloneDocsFolder(
  tag: string,
  destDir: string
): Promise<void> {
  // Create a temp directory for the clone (mkdtempSync ensures uniqueness atomically)
  const tempDir = mkdtempSync(join(tmpdir(), "next-skills-"));

  try {

    // Sparse clone with only docs folder
    try {
      execSync(
        `git clone --depth 1 --filter=blob:none --sparse --branch ${tag} https://github.com/vercel/next.js.git .`,
        {
          cwd: tempDir,
          stdio: "pipe",
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("did not match")) {
        throw new Error(
          `Could not find documentation for Next.js ${tag}. This version may not exist on GitHub yet.`
        );
      }
      throw error;
    }

    // Set sparse-checkout to only include docs
    execSync("git sparse-checkout set docs", {
      cwd: tempDir,
      stdio: "pipe",
    });

    // Copy docs to destination
    const sourceDocsDir = join(tempDir, "docs");

    if (!existsSync(sourceDocsDir)) {
      throw new Error("docs folder not found in cloned repository");
    }

    // Ensure destination exists and is clean
    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true });
    }
    mkdirSync(destDir, { recursive: true });

    // Copy the docs content
    cpSync(sourceDocsDir, destDir, { recursive: true });
  } finally {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true });
    }
  }
}

/**
 * Recursively collect all .md and .mdx files from a directory.
 */
export function collectDocFiles(
  dir: string,
  baseDir: string = dir
): { relativePath: string }[] {
  const files: { relativePath: string }[] = [];

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectDocFiles(fullPath, baseDir));
    } else if (entry.endsWith(".mdx") || entry.endsWith(".md")) {
      // Skip index files
      if (entry === "index.mdx" || entry === "index.md") continue;

      const relativePath = fullPath.slice(baseDir.length + 1);
      files.push({ relativePath });
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
