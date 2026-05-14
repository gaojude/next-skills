---
name: diagnose-page-load
description: End-to-end diagnosis of how a Next.js page loads — errors, SSR contentfulness, and PPR shell quality. Use when the user asks to "diagnose page load", "audit this page", "check why this page is slow / blank / broken on first paint", or before/after a perf or SSR/PPR refactor. Orchestrates diagnose-error → diagnose-ssr → diagnose-ppr with a human-in-the-loop landing/login step in between.
---

# diagnose-page-load

End-to-end diagnosis of a Next.js page's loading behavior. Drives a real
Chrome via agent-browser so the human can navigate / log in, then runs
three sub-diagnoses in order. Each sub-skill is independently runnable
if you only need that slice.

## Prerequisites

- Next.js 16+ dev server with `cacheComponents: true` for the PPR pass.
- `agent-browser` installed.

## Procedure

### 1. Prep the browser session

Invoke [[prep-browser-session]] to verify the dev server is up, launch
system Chrome with the React DevTools hook, and wait for the user to
land on the target page (logging in interactively if needed). It
returns the starting URL via `agent-browser get url`.

Skip this step if the session is already alive — `agent-browser get url`
returning a real URL means prep already ran (this session or a
previous one).

### 2. Run diagnose-error

Invoke the [[diagnose-error]] skill. If it reports any **critical**
errors (anything blocking render — config errors, uncaught exceptions,
500-class network failures on the document/RSC), **abort** and surface
the findings to the user. Don't proceed to SSR/PPR diagnosis on a
broken page.

### 3. Run diagnose-ssr

Invoke the [[diagnose-ssr]] skill. If the page renders blank or only
chrome (header/footer/skeleton) with no real content under JS-disabled,
**abort** and recommend converting the page or its key components to
Server Components.

### 4. Run diagnose-ppr

Invoke the [[diagnose-ppr]] skill. Compare the shell-only screenshot
to the resolved one and report PPR shell quality. If the shell is
empty or near-empty (only skeletons), recommend pulling static UI out
of Suspense boundaries.

### 5. Final report

Synthesize the three sub-reports into a short summary:

- ✅ / ❌ per stage (errors, SSR, PPR)
- For each ❌: the most impactful fix
- Key screenshots referenced by path

## Notes

- The same `agent-browser` browser session is shared across sub-skills;
  don't `agent-browser close` between steps.
- If the user wants to re-run after a code change, reload state:
  `agent-browser --state .claude/diagnose-state.json open "$URL"`.
- The dev server must remain running between sub-skills; the PPR cookie
  lock only works against a live dev server (or a prod build with
  `__NEXT_EXPOSE_TESTING_API=true`).
