---
name: diagnose-ssr
description: Verify a page renders contentful HTML on the server alone — no client JS hydration required. Use when asking "is this page actually SSR'd", "does the user see content before JS arrives", "would this work for crawlers / no-JS users", or to find Server-Component candidates. Loads the page with external JS aborted at the network layer, then judges the resulting paint.
---

# diagnose-ssr

Block every external script, reload, and see what the page paints.
Inline scripts (RSC payload, hydration boot, JSON-LD) still execute —
only `<script src="...">` is denied. This is what a crawler or a
no-JS user sees on first paint.

## Prerequisites

- agent-browser session open (any URL — this skill navigates).
  If unmet, invoke [[prep-browser-session]].

## Procedure

### 1. Block scripts, then reload

Order matters — block before navigating, or the page's first load
slips through.

```bash
URL=$(agent-browser get url)
agent-browser network route "**/*.js"  --abort
agent-browser network route "**/*.mjs" --abort
agent-browser open "$URL"
agent-browser wait --load domcontentloaded
agent-browser screenshot --full /tmp/diagnose-ssr.png
```

Use `domcontentloaded`, not `networkidle` — aborted requests can keep
`networkidle` from ever firing.

### 2. Judge contentfulness

A page is contentful under SSR if a human looking at the screenshot
could understand what the page is:

- Real headings, text, images visible → ✅
- Form fields with real labels, real buttons with real text → ✅
- Skeleton bars / pulse placeholders only → ❌
- Blank, or chrome with empty center → ❌

### 3. Clean up

```bash
agent-browser network unroute "**/*.js"
agent-browser network unroute "**/*.mjs"
agent-browser open "$URL" && agent-browser wait --load networkidle
```

## Output

```
diagnose-ssr: <PASS|FAIL>

URL:        <url>
Screenshot: /tmp/diagnose-ssr.png
Visible:    <one-line summary>

Suggested fix (if FAIL):
  - <e.g. "convert <Foo> to a Server Component — 'use client' at
     the page root forces the tree to wait for JS">
  - <e.g. "move the await inside <Bar> into a parent Server
     Component so its markup ships in the initial HTML">
```

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| Whole page is one big skeleton | `'use client'` at the page root | Move static markup into a Server Component; keep `'use client'` on the smallest interactive leaf. |
| Chrome renders, main content blank | Main content behind one big `<Suspense>` | Inline static parts above Suspense, or narrow the boundaries. See [[diagnose-ppr]]. |
| Text renders but images are gone | JS-driven image loader | Acceptable; verify against a prod build. |
| Hydration warnings later | SSR works; hydration is a separate concern | Out of scope — use [[diagnose-error]]. |

## Related

- [[diagnose-page-load]] — orchestrator.
- [[diagnose-ppr]] — grades the *static shell*; this skill grades
  *server output*. Both can fail independently.
