import { execSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
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
  // Create a temp directory for the clone
  const tempDir = join(tmpdir(), `next-skills-${Date.now()}`);

  try {
    mkdirSync(tempDir, { recursive: true });

    // Sparse clone with only docs folder
    execSync(
      `git clone --depth 1 --filter=blob:none --sparse --branch ${tag} https://github.com/vercel/next.js.git .`,
      {
        cwd: tempDir,
        stdio: "pipe",
      }
    );

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
): { relativePath: string; title: string }[] {
  const files: { relativePath: string; title: string }[] = [];

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
      const title = filenameToTitle(entry);
      files.push({ relativePath, title });
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Convert a filename like "01-installation.mdx" to "Installation"
 */
function filenameToTitle(filename: string): string {
  return filename
    .replace(/^\d+-/, "")
    .replace(/\.(mdx?|md)$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build a hierarchical structure from the flat file list.
 */
export interface DocSection {
  name: string;
  title: string;
  files: { relativePath: string; localPath: string; title: string }[];
  subsections: DocSection[];
}

export function buildDocTree(
  files: { relativePath: string; title: string }[]
): DocSection[] {
  const sections: Map<string, DocSection> = new Map();

  for (const file of files) {
    const parts = file.relativePath.split("/");
    if (parts.length < 2) continue;

    const topLevelDir = parts[0];

    if (!sections.has(topLevelDir)) {
      sections.set(topLevelDir, {
        name: topLevelDir,
        title: filenameToTitle(topLevelDir),
        files: [],
        subsections: [],
      });
    }

    const section = sections.get(topLevelDir)!;
    const localPath = `./docs/${file.relativePath}`;

    if (parts.length === 2) {
      section.files.push({
        relativePath: file.relativePath,
        localPath,
        title: file.title,
      });
    } else {
      const subsectionDir = parts[1];
      let subsection = section.subsections.find((s) => s.name === subsectionDir);

      if (!subsection) {
        subsection = {
          name: subsectionDir,
          title: filenameToTitle(subsectionDir),
          files: [],
          subsections: [],
        };
        section.subsections.push(subsection);
      }

      if (parts.length === 3) {
        subsection.files.push({
          relativePath: file.relativePath,
          localPath,
          title: file.title,
        });
      } else {
        const subSubDir = parts[2];
        let subSubsection = subsection.subsections.find((s) => s.name === subSubDir);

        if (!subSubsection) {
          subSubsection = {
            name: subSubDir,
            title: filenameToTitle(subSubDir),
            files: [],
            subsections: [],
          };
          subsection.subsections.push(subSubsection);
        }

        subSubsection.files.push({
          relativePath: file.relativePath,
          localPath,
          title: file.title,
        });
      }
    }
  }

  // Sort everything
  const sortedSections = Array.from(sections.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const section of sortedSections) {
    section.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    section.subsections.sort((a, b) => a.name.localeCompare(b.name));
    for (const subsection of section.subsections) {
      subsection.files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
      subsection.subsections.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return sortedSections;
}
