# next-skills

Agent skills for diagnosing Next.js page load, SSR contentfulness, and
PPR (Partial Prerendering) shell quality. Drive a real Chrome via
[`agent-browser`](https://github.com/vercel-labs/next-browser) so you
can see exactly what your user would see — errors, blank shells,
hydration cliffs.

## Install

```bash
npx skills add gaojude/next-skills
```

Works with Claude Code, Cursor, Codex, and the other agents the
[`skills`](https://skills.sh) CLI supports.

## Skills

| Skill | What it does |
| --- | --- |
| [`diagnose-page-load`](skills/diagnose-page-load/SKILL.md) | End-to-end: orchestrates the three leaf diagnoses below in order. Start here. |
| [`diagnose-error`](skills/diagnose-error/SKILL.md) | Browser console errors, Next.js compile errors, dev-server runtime errors, obvious UI breakage. |
| [`diagnose-ssr`](skills/diagnose-ssr/SKILL.md) | Verify the page paints contentful HTML with all client JS aborted at the network layer. |
| [`diagnose-ppr`](skills/diagnose-ppr/SKILL.md) | Grade the PPR static shell — what the user sees before dynamic content streams in. |
| [`diagnose-instant-nav`](skills/diagnose-instant-nav/SKILL.md) | Grade the shell for an internal client-side navigation — what the user sees the instant they click a link. |
| [`prep-browser-session`](skills/prep-browser-session/SKILL.md) | Bootstrap the browser session the diagnose-* skills assume. Invoked automatically by `diagnose-page-load`; run directly when a leaf reports no active session. |

## Prerequisites

- Next.js 16+ dev server. PPR diagnostics assume `cacheComponents: true`.
- [`agent-browser`](https://github.com/vercel-labs/next-browser) on PATH
  (`npm i -g @vercel/next-browser && playwright install chromium`).
- System Chrome (the skills launch it via `--executable-path` rather
  than the Playwright-bundled testing browser).
