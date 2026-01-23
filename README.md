# next-agents-md

Generate a documentation index for Claude/Agents files in Next.js projects.

## Usage

Run in your Next.js project:

```bash
npx @judegao/next-agents-md
```

This starts an interactive prompt that will:
1. Detect your Next.js version (or let you enter one)
2. Let you choose the target file (CLAUDE.md, AGENTS.md, or custom)

### Non-interactive mode

Skip prompts by providing both options:

```bash
npx @judegao/next-agents-md --next-version 15.1.3 --agents-md-file CLAUDE.md
```

### Options

- `--next-version <version>` - Override Next.js version
- `--agents-md-file <path>` - Target markdown file

## What it does

- Downloads Next.js docs into `.next-docs`
- Builds a compact index
- Injects the index into your chosen markdown file (default `CLAUDE.md`)
- Adds `.next-docs/` to `.gitignore`

## License

MIT
