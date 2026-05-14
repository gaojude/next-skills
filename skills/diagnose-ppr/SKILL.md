---
name: diagnose-ppr
description: Verify and grade the PPR (Partial Prerendering) static shell of a Next.js page. Use when asking "is the PPR shell good", "what's in the static shell vs streamed", "does this Suspense boundary actually help", or after restructuring Suspense / `'use cache'`. Compares the locked shell to the resolved page via screenshots. Assumes an agent-browser session opened with `--enable react-devtools` is on the target page.
---

# diagnose-ppr

Measures how much real content lives in the PPR static shell vs how
much streams in. The cookie-lock protocol makes the shell observable;
the React DevTools Suspense view shows where boundaries actually sit.

## Prerequisites

- Next.js 16+ with `cacheComponents: true` — without it, there is no
  PPR to test.
- agent-browser session on the target page, opened with
  `--enable react-devtools` (`agent-browser react ...` errors without
  the hook). If unmet, invoke [[prep-browser-session]] first.

## Procedure

### 1. Static check: layout-level data access

The #1 cause of broken PPR shells is awaiting `params`, `cookies()`,
`headers()`, or `searchParams` at the top of a layout. The function
body runs serially after that await, so nothing renders statically.

```bash
grep -nE "^\s*(const|let)\s+\w+\s*=\s*await\s+(props\.)?(params|cookies|headers|searchParams)" \
  app/**/layout.tsx app/**/page.tsx 2>/dev/null
```

Any hit on a **layout** in the route's parent chain is grade-F before
the browser test even runs. The fix is to push the await into a
Suspense'd child component so the layout body is synchronously
renderable.

### 2. Hard-reload with the lock cookie

`CookieStore` dedupes identical writes — include a random ID:

```bash
URL=$(agent-browser get url)
RAND="p$(awk 'BEGIN{srand(); print rand()}')"
agent-browser cookies set next-instant-navigation-testing "[0,\"$RAND\"]" --url "$URL"
agent-browser open "$URL" && agent-browser wait --load networkidle
agent-browser screenshot --full /tmp/diagnose-ppr-shell.png
agent-browser react suspense --only-dynamic > /tmp/diagnose-ppr-shell-suspense.txt
```

`react suspense --only-dynamic` lists the boundaries still suspended
— those are the holes in the static shell.

### 3. Check the dev server log for bailouts

If the shell screenshot looks suspiciously empty, grep the dev log:

```
NEXT_STATIC_GEN_BAILOUT
Route "/...": Next.js encountered uncached or runtime data
```

When you see a bailout, release the lock, hard-reload the page,
then run `agent-browser react suspense --json` to see the real
blockers.

### 4. Release the lock and capture resolved

```bash
agent-browser eval "document.cookie='next-instant-navigation-testing=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'"
agent-browser open "$URL" && agent-browser wait --load networkidle
agent-browser screenshot --full /tmp/diagnose-ppr-resolved.png
```

### 5. Compare screenshots and grade

| Shell contents | Grade | Meaning |
|---|---|---|
| Most chrome + most real content | **A** | Tight Suspense boundaries; static shell does its job. |
| Chrome + structure, key content streams in | **B** | Reasonable. Could pull more above Suspense or `'use cache'` it. |
| Only chrome (header/nav/footer) | **C** | One giant Suspense near the page root. |
| Skeleton-only or blank | **F** | Whole page behind one Suspense, or layout awaits dynamic data at the top. |

## Output

```
diagnose-ppr: <A|B|C|F>

Shell:        /tmp/diagnose-ppr-shell.png
Resolved:     /tmp/diagnose-ppr-resolved.png
Suspense:     /tmp/diagnose-ppr-shell-suspense.txt

Layout-await bailouts:
  <file:line> awaits <params/cookies/headers/searchParams>
  (or: "none found")

What's in the shell:
  <bullet list>

What streams in:
  <bullet list>

Opportunities (if grade < A):
  - <e.g. "wrap the params-await in (no-scope)/layout.tsx:33 in a
     child Suspense so the layout body renders statically">
  - <e.g. "mark getFoo() with 'use cache' — result is stable enough
     to live in the shell">
```

## Gotchas

- **Dev vs prod differ.** In dev, Next.js falls back to dynamic
  rendering more aggressively and ships extra script tags. Confirm
  findings against a production build before refactoring.
- **`'use cache'` hits look "dynamic" but aren't.** If you see real
  numbers/names in the locked shell, that's the cache hitting at
  prerender time — grade A is correct.
- **Cookie scoping.** `localhost` and `127.0.0.1` have separate
  cookie jars. The `--url "$URL"` flag handles this.

## Related

- [[diagnose-page-load]] — orchestrator.
- [[diagnose-instant-nav]] — grades the *transition* into a route
  via client-side nav.
