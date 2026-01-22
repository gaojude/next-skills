# next-skills

Generate a CLAUDE.md documentation index for Next.js projects.

## Usage

Run in your Next.js project:

```bash
npx @judegao/next-skills
```

Optional override:

```bash
npx @judegao/next-skills --nextjs-version 15.1.3
```

## What it does

- Downloads Next.js docs into `.next-docs`
- Builds a compact index
- Injects the index into `CLAUDE.md`
- Adds `.next-docs/` to `.gitignore`

## License

MIT
