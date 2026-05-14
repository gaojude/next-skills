---
name: diagnose-page-load
description: End-to-end diagnosis of how a Next.js page loads — errors, SSR contentfulness, and PPR shell quality. Use when asking to "diagnose page load", "audit this page", or "check why this page is slow / blank / broken on first paint". Orchestrates diagnose-error → diagnose-ssr → diagnose-ppr.
---

# diagnose-page-load

Orchestrator. Each sub-skill is independently runnable; use this one
when you want all three on the same page in one go.

## Procedure

1. Invoke [[prep-browser-session]] if there's no live agent-browser
   session yet.
2. Invoke [[diagnose-error]]. If it FAILs, abort and surface the
   report — deeper diagnoses on a broken page are meaningless.
3. Invoke [[diagnose-ssr]]. If it FAILs, recommend converting key
   components to Server Components and stop.
4. Invoke [[diagnose-ppr]].
5. Summarize: ✅/❌ per stage, the most impactful fix per ❌, paths
   to the key screenshots.

## Notes

- One agent-browser session for all of it — don't `agent-browser close`
  between steps.
- The PPR cookie lock requires a live dev server (or a prod build with
  `__NEXT_EXPOSE_TESTING_API=true`).
- Re-runs after a code change: `agent-browser --state .claude/diagnose-state.json open "$URL"`.
