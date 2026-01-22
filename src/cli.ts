import { Command } from "commander";
import { runExperimentalClaudeMd } from "./commands/experimental-claude-md.js";

export async function run(): Promise<void> {
  const program = new Command();

  program
    .name("next-skills")
    .description("Generate a CLAUDE.md index for Next.js documentation")
    .option("--nextjs-version <version>", "Override Next.js version")
    .option(
      "--experimental-claude-md",
      "Generate the CLAUDE.md docs index (default behavior)"
    )
    .action(async (options: { nextjsVersion?: string }) => {
      await runExperimentalClaudeMd({ nextjsVersion: options.nextjsVersion });
    });

  await program.parseAsync();
}
