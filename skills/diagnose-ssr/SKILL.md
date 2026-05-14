---
name: diagnose-ssr
description: Verify a page renders contentful HTML on the server alone — no client JS hydration required. Use when asking "is this page actually SSR'd", "does the user see content before JS arrives", "would this work for crawlers / no-JS users", or to find Server-Component candidates. Loads the page with all external JS aborted at the network layer, then judges the resulting paint. Assumes an agent-browser session is already on (or can navigate to) the target URL.
---

# diagnose-ssr

Test whether the page is meaningfully server-rendered by blocking every
external script and reloading. Inline scripts (RSC payload, hydration
boot, JSON-LD) still execute — only `<script src="...">` is denied.
What you see is what a crawler, a no-JS user, or someone on a flaky
network sees on first paint.

## Prerequisites

- An `agent-browser` session already opened (any URL is fine; the
  skill navigates to the target itself). Probe with:

  ```bash
  agent-browser get url    # errors if no session; prints URL if alive
  ```

  If unmet, invoke [[prep-browser-session]] first to bootstrap.
- The target URL — captured from `agent-browser get url` or passed by
  the caller.

## Procedure

### 1. Capture the target URL

```bash
URL=$(agent-browser get url)
# or use the URL passed in by the caller
```

### 2. Install network blocks BEFORE navigation

Order matters — block first, navigate second. Otherwise the page's
first load slips through.

```bash
agent-browser network route "**/*.js"  --abort
agent-browser network route "**/*.mjs" --abort
```

These match by URL pattern, so externally-hosted bundles (CDNs,
analytics) are caught too.

### 3. Hard-reload the page

```bash
agent-browser open "$URL"
agent-browser wait --load domcontentloaded
```

Use `domcontentloaded` not `networkidle` — `networkidle` may never
fire when scripts are being aborted (failed requests count as
"in-flight" briefly).

### 4. Capture

```bash
agent-browser screenshot --full /tmp/diagnose-ssr.png
agent-browser snapshot -i -c > /tmp/diagnose-ssr-snapshot.txt
agent-browser get text body > /tmp/diagnose-ssr-text.txt 2>/dev/null
```

### 5. Judge contentfulness

A page is **contentful under SSR** if a human looking at the screenshot
could understand what the page is. Concretely:

- Headings, real text, real images visible — ✅
- Form fields with real labels, real buttons with real text — ✅
- Skeleton bars / pulse placeholders only — ❌
- Blank page — ❌
- Layout chrome (header/nav/footer) but center is empty — ❌

The accessibility snapshot helps disambiguate: if `snapshot -i` only
contains structural roles and no `[heading]` / `[text]` / `[link]`
with real content, the page is not contentful.

### 6. Clean up

```bash
agent-browser network unroute "**/*.js"
agent-browser network unroute "**/*.mjs"
```

Re-load the page so subsequent diagnoses see the normal state:

```bash
agent-browser open "$URL"
agent-browser wait --load networkidle
```

## Output

```
diagnose-ssr: <PASS|FAIL>

URL: <url>
Screenshot: /tmp/diagnose-ssr.png
Visible content: <one-line summary, e.g. "title + form fields rendered"
                  / "only skeleton placeholders" / "blank">
Suggested fix (if FAIL):
  - <e.g. "convert <Foo> to a Server Component — currently 'use client'
     at the page root forces the entire tree to wait for JS">
  - <e.g. "move the await inside <Bar> into a parent server component
     so the markup is in the initial HTML">
```

## Common fail modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Whole page is one big skeleton | Page is a Client Component (`'use client'` at the top) | Move static markup into a Server Component; keep `'use client'` on the smallest interactive leaf. |
| Page renders chrome but main content is blank | Main content sits behind a single big `<Suspense>` whose children are dynamic | Either inline the static parts above Suspense, or narrow the Suspense boundaries (see [[diagnose-ppr]]). |
| Page renders text but images are gone | Images use a JS-driven loader (e.g. `next/image` with a runtime polyfill) | Acceptable if non-blocking; check the actual prod build, dev mode sometimes ships extra script tags. |
| Page renders fully but you see hydration warnings later | SSR works; hydration mismatch is a separate concern | Out of scope for this skill — handle via [[diagnose-error]]. |
