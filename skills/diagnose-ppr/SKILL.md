---
name: diagnose-ppr
description: Verify and grade the PPR (Partial Prerendering) static shell of a Next.js page. Use when asking "is the PPR shell good", "what's in the static shell vs streamed", "does this Suspense boundary actually help", "test instant navigation", or after restructuring Suspense / `'use cache'`. Uses the `next-instant-navigation-testing` cookie lock to render the shell alone, then releases for the resolved state, and compares. Assumes an agent-browser session opened with `--enable react-devtools` is on the target page.
---

# diagnose-ppr

Measures how much real content lives in the PPR static shell vs how
much streams in after dynamic data resolves. The cookie-lock protocol
makes the static shell observable in a real browser; the React DevTools
Suspense view shows where boundaries actually sit.

## Prerequisites

- Next.js 16+ with `cacheComponents: true` (mandatory — without it
  there is no PPR to test).
- An `agent-browser` session opened with `--enable react-devtools`
  (the DevTools hook is installed at launch only — `react suspense`
  errors without it). Target page already loaded. Probe with:

  ```bash
  agent-browser get url       # session alive?
  agent-browser react suspense > /dev/null 2>&1  # hook installed?
  ```

  If either probe fails, invoke [[prep-browser-session]] first to
  bootstrap (it relaunches with the hook).

## Procedure

### 1. Confirm cacheComponents is enabled

```bash
grep -E 'cacheComponents\s*[:=]\s*true' next.config.*
```

If nothing matches: **abort** with:

> "This app does not have `cacheComponents: true` in next.config.*.
> Without it, the static shell is the whole page or nothing, and PPR
> diagnosis is meaningless. Enable `cacheComponents: true` and rerun."

### 2. Capture the URL

```bash
URL=$(agent-browser get url)
```

### 3. Acquire the navigation lock

Random ID is mandatory — `CookieStore` dedupes identical writes, so
reusing `[0,"p"]` won't re-trigger the lock the second time.

```bash
RAND="p$(awk 'BEGIN{srand(); print rand()}')"
agent-browser cookies set next-instant-navigation-testing "[0,\"$RAND\"]" --url "$URL"
```

### 4. Hard-reload and capture the shell

```bash
agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser screenshot --full /tmp/diagnose-ppr-shell.png
agent-browser snapshot -i -c > /tmp/diagnose-ppr-shell-snap.txt
agent-browser react suspense --only-dynamic > /tmp/diagnose-ppr-shell-suspense.txt
```

`react suspense --only-dynamic` shows boundaries that are still
suspended (have a pending child) — exactly the holes in the static
shell.

### 5. Release the lock

`agent-browser cookies` has no per-name delete; expire it via JS:

```bash
agent-browser eval "document.cookie='next-instant-navigation-testing=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'"
```

### 6. Hard-reload and capture the resolved state

```bash
agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser screenshot --full /tmp/diagnose-ppr-resolved.png
agent-browser snapshot -i -c > /tmp/diagnose-ppr-resolved-snap.txt
agent-browser react suspense > /tmp/diagnose-ppr-resolved-suspense.txt
```

### 7. Analyze and grade

Compare the two pairs. Useful angles:

- **Visual diff**: Open both screenshots in Preview. What's *only* in
  the resolved screenshot? Those are the things that streamed in
  (i.e. live in Suspense holes). Everything in the shell screenshot
  is in the static shell.
- **Snapshot diff**: `diff` the two snapshot files. The lines unique
  to `resolved-snap.txt` are dynamic content.
- **Suspense tree**: lines in `shell-suspense.txt` are unresolved
  boundaries. The fewer / smaller, the more is in the shell. Compare
  to `resolved-suspense.txt` to see what each boundary was hiding.

### 8. Grade the shell

| Shell contents | Grade | Meaning |
|---|---|---|
| Most chrome + most real content visible | **A** | Excellent. Suspense boundaries are tight around genuinely-dynamic data. |
| Chrome + structure visible but key content streams in | **B** | Reasonable. Could tighten by pulling more above the Suspense boundary or marking data `'use cache'`. |
| Only chrome (header/nav/footer) | **C** | Lots of room to grow. Inspect why the main content is dynamic — usually one giant `<Suspense>` near the page root. |
| Only skeletons / blank | **F** | The whole page is behind a single Suspense, or the page root component awaits dynamic data. Refactor: pull static markup out of the Suspense; wrap individual dynamic leaves in narrow Suspense boundaries. |

## Output

```
diagnose-ppr: <A|B|C|F>

cacheComponents: <enabled|missing>
Shell screenshot:    /tmp/diagnose-ppr-shell.png
Resolved screenshot: /tmp/diagnose-ppr-resolved.png
Suspense (shell):    /tmp/diagnose-ppr-shell-suspense.txt
Suspense (resolved): /tmp/diagnose-ppr-resolved-suspense.txt

What's in the shell:
  <bullet list — title, nav, buttons, etc.>

What streams in:
  <bullet list — user counts, comments, etc.>

Opportunities (only if grade < A):
  - <e.g. "move the user-count read inside a narrow Suspense — currently
     the whole page sits behind one Suspense fallback">
  - <e.g. "mark getFoo() with 'use cache' — its result is stable enough
     to live in the shell">
```

## Gotchas

- **Same browser session** between shell and resolved capture. Don't
  `agent-browser close` mid-flow — you'd lose the React DevTools hook.
- **Cookie scoping** — `localhost` and `127.0.0.1` have separate cookie
  jars. The `--url "$URL"` flag handles this; don't hand-edit the
  domain.
- **The shell may include "dynamic-looking" data**. With `'use cache'`,
  data resolves at prerender time and gets baked into the shell HTML.
  If you see real numbers/names under the lock, that's not a bug —
  it's the cache hitting. Grade A is the right outcome there.
- **`react suspense` requires `--enable react-devtools`** at session
  start. If it errors, the caller didn't open with that flag — restart
  the session.

## Related

- [[diagnose-page-load]] — orchestrator that calls this skill.
- [[diagnose-instant-nav]] — grades the *transition* into a route via
  client-side navigation, isolating per-route shell content from
  shared layout chrome.
