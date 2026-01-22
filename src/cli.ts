import { Command } from "commander";
import { runExperimentalClaudeMd } from "./commands/experimental-claude-md.js";

export async function run(): Promise<void> {
  const program = new Command();

  program
    .name("next-skills")
    .description("Generate a documentation index for Claude/Agents files")
    .option("--nextjs-version <version>", "Override Next.js version")
    .option("--file <path>", "Target markdown file", "CLAUDE.md")
    .option(
      "--experimental-claude-md",
      "Generate the docs index (default behavior)"
    )
    .action(async (options: { nextjsVersion?: string; file?: string }) => {
      await runExperimentalClaudeMd({
        nextjsVersion: options.nextjsVersion,
        outputFile: options.file,
      });
    });

  await program.parseAsync();
}
