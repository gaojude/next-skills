# next-skills

Generate a documentation index for Claude/Agents files in Next.js projects.

## Usage

Run in your Next.js project:

```bash
npx @judegao/next-skills
```

Optional override:

```bash
npx @judegao/next-skills --nextjs-version 15.1.3
```

Target a different file:

```bash
npx @judegao/next-skills --file AGENTS.md
```

## What it does

- Downloads Next.js docs into `.next-docs`
- Builds a compact index
- Injects the index into your chosen markdown file (default `CLAUDE.md`)
- Adds `.next-docs/` to `.gitignore`

## License

MIT
