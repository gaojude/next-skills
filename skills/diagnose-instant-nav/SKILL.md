---
name: diagnose-instant-nav
description: Grade the PPR shell for an **internal client-side navigation** — what the user sees the instant they click a link, before dynamic content streams in. Unlike [[diagnose-ppr]] (which grades a page's full shell), this isolates the *transition* — anything already in the shared layout is "free." Use when asking "is this link's destination instant", "what would the user see between click and full render", "is the prefetch shell big enough to feel native".
---

# diagnose-instant-nav

Grades one client-side navigation. Distinct from [[diagnose-ppr]]
because shared chrome is already on screen at click time — what
matters is the *changing* portion of the viewport in the first frame
after the route changes.

## Prerequisites

- Next.js 16+ with `cacheComponents: true`.
- agent-browser session on the **source** page, opened with
  `--enable react-devtools`. If unmet, invoke
  [[prep-browser-session]] first.
- A destination path (`$TO_PATH`) — either passed by the caller or
  inferred from the user's intent ("settings", "the new-chat button").
  Don't enumerate every link on the page; just resolve the path.

## Procedure

### 1. Warm the destination

In dev, the first hit to a route pays Turbopack compile time. Hit
the destination once, then return to the source so the actual test
measures shell rendering, not compilation.

```bash
FROM_URL=$(agent-browser get url)
agent-browser open "$TO_URL" && agent-browser wait --load networkidle
agent-browser open "$FROM_URL" && agent-browser wait --load networkidle
```

### 2. Acquire the navigation lock

`CookieStore` dedupes identical writes, so include a random ID — the
literal `[0,"p"]` won't re-trigger the lock on a second run.

```bash
RAND="p$(awk 'BEGIN{srand(); print rand()}')"
agent-browser cookies set next-instant-navigation-testing "[0,\"$RAND\"]" --url "$FROM_URL"
```

### 3. Navigate via `pushstate` and wait for the swap

`agent-browser pushstate` calls `window.next.router.push` directly.
Use it instead of clicking the actual link — it sidesteps menu
portals, stale refs, and dropdown click interception that have
nothing to do with the navigation you're trying to measure.

In dev, the first prerender of an unhit route can take several
seconds even when the shell is structurally fine. Don't use a fixed
`wait 800` — poll for the URL swap on a budget.

```bash
BUDGET_MS=${BUDGET_MS:-15000}
agent-browser pushstate "$TO_PATH"
ELAPSED=timeout
START=$(python3 -c 'import time; print(int(time.time()*1000))')
for i in $(seq 1 $((BUDGET_MS / 250))); do
  case "$(agent-browser get url 2>/dev/null)" in
    *"$TO_PATH"*)
      ELAPSED=$(($(python3 -c 'import time; print(int(time.time()*1000))') - START))
      break ;;
  esac
  sleep 0.25
done
echo "swap elapsed: ${ELAPSED}ms"
agent-browser screenshot --full /tmp/diagnose-instant-nav-shell.png
```

Don't use `agent-browser wait --url` — it has no built-in timeout
and will hang if the swap never happens.

The shell screenshot captures what the user sees the moment the
swap completes — the meaningful frame, since the lock cookie tells
the router to swap only after a prerendered shell is available.

**If `ELAPSED` is `timeout`**, the router refused — grade F. To see
what blocked it, release the lock, hard-reload the source page,
capture `agent-browser react suspense --json`, navigate (no lock)
to `$TO_URL`, and capture the Suspense tree again. The diff shows
what the destination needed that the source didn't. Skip to step 5.

### 4. Release the lock and capture resolved

```bash
agent-browser eval "document.cookie='next-instant-navigation-testing=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'"
agent-browser open "$TO_URL" && agent-browser wait --load networkidle
agent-browser screenshot --full /tmp/diagnose-instant-nav-resolved.png
```

### 5. Compare screenshots and grade

Open both screenshots and judge by eye. The question is: how much of
the resolved page is already visible in the shell?

| Shell vs resolved | Grade | Meaning |
|---|---|---|
| Most route content already painted | **A** | Suspense boundaries are tight; transition feels native. |
| Route header + structure visible, main content fills in | **B** | User sees the page changed; details stream in. |
| Just the layout swap, content still loading | **C** | Most of `page.tsx` is behind one big Suspense. |
| URL never swapped within the budget | **F** | Route is fully dynamic, or router refused to navigate. |

Grade by **shell content**, not elapsed time. The elapsed time is
a dev-mode artifact — production prerender shells are built ahead
and served instantly. A long wait that ends with grade-A content
means production will be instant; a fast wait that ends with empty
content means production will paint nothing on click.

## Output

```
diagnose-instant-nav: <A|B|C|F>

Transition:   <FROM_URL> → <TO_URL>
Shell:        /tmp/diagnose-instant-nav-shell.png
Resolved:     /tmp/diagnose-instant-nav-resolved.png

What's in the shell:
  <e.g. "page title 'Search'", "filter chips", "result count">

What streams in:
  <e.g. "search results list", "trending tags">

Opportunities (if grade < A):
  - <e.g. "destination's page title is inside Suspense — hoist it
     out so the transition shows the title instantly">
  - <e.g. "filter option list is static — mark it `'use cache'`
     and pull it into the shell">
```

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Router didn't navigate under lock | Destination has no static shell — usually `await params/cookies/headers` at the top of a layout. | See [[diagnose-ppr]] for the layout-grep recipe. |
| Shell == source visually | Per-route shell is empty; `page.tsx` is fully dynamic. | Hoist static markup out of Suspense in `page.tsx`. |
| Shell == resolved | Either truly static (A) or the cookie didn't apply. Verify with `agent-browser cookies get`. | — |

## Notes

- Per-segment layouts: if FROM and TO are in different route groups
  (`(group-a)/layout.tsx` vs `(group-b)/layout.tsx`), the user *will*
  see the layout swap. Count that as transition cost, not free chrome.
- Re-running: navigate back with `agent-browser back`, then resume
  from step 2. Each run needs a fresh random cookie value.

## Related

- [[diagnose-ppr]] — grades a single page's shell on hard reload.
- [[diagnose-page-load]] — full-page orchestrator.
