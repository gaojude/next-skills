---
name: diagnose-instant-nav
description: Grade the PPR shell for an **internal client-side navigation** — what the user sees the instant they click a link, before dynamic content streams in. Unlike [[diagnose-ppr]] (which grades the whole page including shared chrome), this skill isolates the *transition* — anything that's already in the shared layout is "free" since the user already sees it. Use when asking "is this link's destination instant", "what would the user see between click and full render", "is the prefetch shell big enough to feel native".
---

# diagnose-instant-nav

End-to-end diagnosis of a single client-side navigation — from clicking a
`<Link>` on the current page to the destination's resolved render.

This is **different from [[diagnose-ppr]]**, which grades a page's full
shell measured against a hard reload. For instant-nav, the shared layout
(header, bottom nav, sticky chrome) is *already on screen* when the user
clicks — those bytes are free. The thing that matters is: **what fills
the changing portion of the viewport in the first frame after click?**

If the destination's per-route shell is rich, the transition feels native.
If it's just skeletons until streams resolve, the transition feels like a
mini-page-load.

## Prerequisites

- Next.js 16+ with `cacheComponents: true` (mandatory — see [[diagnose-ppr]]
  for why).
- An `agent-browser` session opened with `--enable react-devtools`
  (`react suspense` needs the hook installed at launch). **Parked on
  the source page** — the page the user would click *from*. The skill
  records that URL, picks a destination link, then drives the
  transition. Probe with:

  ```bash
  agent-browser get url       # session alive? returns source URL
  agent-browser react suspense > /dev/null 2>&1  # hook installed?
  ```

  If either probe fails, invoke [[prep-browser-session]] first to
  bootstrap (ask the user to land on the source page during the
  human-in-the-loop step).

## Procedure

### 1. Capture the source page

```bash
FROM_URL=$(agent-browser get url)
```

Snapshot the source so we can later subtract its content from the
destination's shell to find what's *net-new for the destination*:

```bash
agent-browser snapshot -i -c > /tmp/diagnose-instant-nav-source.txt
```

### 2. Find candidate destination links

```bash
agent-browser snapshot -i -c | grep -E '^\s*- (link|button)' > /tmp/diagnose-instant-nav-candidates.txt
```

For each candidate, the a11y line shows a `[ref=eN]` you can later click
by ref. Internal-navigation links use Next.js `<Link>` and will trigger
client-side routing; raw `<a>` tags and external links won't.

When a candidate's destination is ambiguous, inspect its `href`:

```bash
agent-browser get attr "[ref=e72]" href
```

Filter to links whose `href` starts with `/` (same-origin paths) — those
are the client-side navigations worth measuring.

### 3. Ask the user which link to follow

Use `AskUserQuestion` with the filtered candidates as options. If the
user passes a target in the skill arguments (e.g. `--target "搜索"`),
match it by accessible name and skip the prompt.

Record both the chosen ref and the anticipated destination path:

```bash
TARGET_REF="e73"     # whatever the user picked
TARGET_NAME="搜索"    # for reporting
```

### 4. Acquire the navigation lock

Random ID is mandatory — `CookieStore` dedupes identical writes, so the
literal `[0,"p"]` won't re-trigger the lock the second time in a
session:

```bash
RAND="p$(awk 'BEGIN{srand(); print rand()}')"
agent-browser cookies set next-instant-navigation-testing "[0,\"$RAND\"]" --url "$FROM_URL"
```

The cookie is path-scoped to the source URL's origin, which covers the
destination (same origin = same cookie jar). The next client-side
navigation request will carry it; the server will return only the
static shell and hold dynamic boundaries suspended.

### 5. Click and capture the shell

```bash
agent-browser click "[ref=$TARGET_REF]"
# Client-side nav has no networkidle event; wait briefly then settle:
agent-browser wait 800
TO_URL=$(agent-browser get url)
echo "Navigated: $FROM_URL → $TO_URL"
```

Sanity check: `TO_URL` should differ from `FROM_URL`. If it's identical,
the click didn't navigate (could be a button that opens a modal, or an
external link that opened a new tab). Abort and ask the user to pick a
different link.

Capture the locked shell:

```bash
agent-browser screenshot --full /tmp/diagnose-instant-nav-shell.png
agent-browser snapshot -i -c > /tmp/diagnose-instant-nav-shell-snap.txt
agent-browser react suspense --only-dynamic > /tmp/diagnose-instant-nav-shell-suspense.txt
```

### 6. Release the lock and capture resolved

`agent-browser cookies` has no per-name delete; expire it via JS:

```bash
agent-browser eval "document.cookie='next-instant-navigation-testing=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'"
```

Now reload the destination so the streams resolve:

```bash
agent-browser open "$TO_URL"
agent-browser wait --load networkidle
agent-browser screenshot --full /tmp/diagnose-instant-nav-resolved.png
agent-browser snapshot -i -c > /tmp/diagnose-instant-nav-resolved-snap.txt
agent-browser react suspense > /tmp/diagnose-instant-nav-resolved-suspense.txt
```

### 7. Three-way diff and grade

Compare **three** snapshots — source, destination-shell, destination-
resolved — to separate shared chrome from per-route content:

```bash
# Strip refs (they're fresh per capture) and force C locale (default
# macOS locale mis-sorts CJK and silently drops matches).
strip() { sed -E 's/, ref=[a-z0-9]+//g; s/ \[ref=[a-z0-9]+\]//g' "$1" | LC_ALL=C sort -u; }

# Lines present in destination-shell but NOT in source = net-new shell content
LC_ALL=C comm -23 \
  <(strip /tmp/diagnose-instant-nav-shell-snap.txt) \
  <(strip /tmp/diagnose-instant-nav-source.txt) \
  > /tmp/diagnose-instant-nav-newshell.txt

# Lines present in destination-resolved but NOT in destination-shell = streamed
LC_ALL=C comm -23 \
  <(strip /tmp/diagnose-instant-nav-resolved-snap.txt) \
  <(strip /tmp/diagnose-instant-nav-shell-snap.txt) \
  > /tmp/diagnose-instant-nav-streamed.txt
```

`LC_ALL=C` is required — without it, `sort`/`comm` use the user's locale
and on macOS that mis-collates CJK characters, silently dropping lines
that *are* unique. The `strip` helper removes the per-capture `ref=eN`
annotations so identical content matches across captures. If diff
output still looks suspicious, fall back to side-by-side visual
inspection of the screenshots.

The size of `newshell.txt` vs `streamed.txt` tells the story:

| Net-new in shell | Streamed | Grade | Meaning |
|---|---|---|---|
| Most route content present | Only genuinely-dynamic leaves | **A** | Transition feels native. Suspense boundaries are tight. |
| Route header + structure | Main content streams in | **B** | Good — user sees the *page changed*; details fill in. |
| Almost nothing new (still chrome) | Everything for this route | **C** | The destination's `page.tsx` is mostly behind one big Suspense. Click feels like a loader spinner over the old layout. |
| Nothing new — destination shell == source | Whole destination | **F** | The destination route is fully dynamic. Prefetch yields no instant feedback. |

## Output

```
diagnose-instant-nav: <A|B|C|F>

Transition:        <FROM_URL> → <TO_URL>
Picked link:       "<TARGET_NAME>" (ref=<TARGET_REF>)
Shell screenshot:    /tmp/diagnose-instant-nav-shell.png
Resolved screenshot: /tmp/diagnose-instant-nav-resolved.png
Suspense (shell):    /tmp/diagnose-instant-nav-shell-suspense.txt
Suspense (resolved): /tmp/diagnose-instant-nav-resolved-suspense.txt

Net-new in shell (vs source page):
  <bullet list — e.g. "page title 'Search'", "filter chips",
                 "result count">

What streams in after the shell:
  <bullet list — e.g. "search results list", "trending tags">

Opportunities (only if grade < A):
  - <e.g. "the destination's page title is inside a Suspense — hoist it
     above the boundary so the transition shows the title instantly">
  - <e.g. "the filter UI's option list is static — mark it `'use cache'`
     and pull it into the destination's shell">
```

## Common fail modes and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Shell screenshot looks identical to source | Click navigated but destination's static shell == shared layout (route's `page.tsx` is fully dynamic) | Pull static UI out of `<Suspense>` in destination `page.tsx`. See the [[diagnose-ppr]] grade-F fix patterns. |
| Shell screenshot looks identical to resolved | Either the route has no dynamic content (great — Grade A on the route, but `diagnose-instant-nav` can't distinguish it from a lock failure) or the cookie wasn't sent. Check with `agent-browser cookies get` after step 4 and confirm the cookie is present on the destination's origin. |
| `TO_URL == FROM_URL` after click | Picked link didn't navigate (modal, external, blocked) | Re-pick a link; prefer entries with `href="/..."`. |
| `react suspense` errors out | Session wasn't opened with `--enable react-devtools` | Restart via [[diagnose-page-load]] step 2, or `agent-browser open --enable react-devtools …`. |
| Snapshot diff shows everything as "new" | Layout *does* change route-to-route (different `(group)` layouts) | Expected — the diff is honest. Inspect screenshots manually to judge what's "chrome the user expected" vs "shell content for this route". |

## Notes

- **Same session throughout** — don't `agent-browser close` between
  steps; you'd lose the React DevTools hook and the source-page
  snapshot context.
- **Re-running on the same destination**: navigate back with
  `agent-browser back` to return to the source, then re-run from step 4.
  Each run uses a fresh random cookie value to dodge `CookieStore`
  dedup.
- **Per-segment layouts**: if FROM and TO are in different route groups
  (different `(group)/layout.tsx`), the "shared chrome" subtraction in
  step 7 will under-count chrome. That's a feature, not a bug — the
  user *will* see the layout change, so it counts as transition cost.

## Related

- [[diagnose-ppr]] — grades a single page's shell against hard reload.
  Use that when you want to know "is this page's shell good"; use *this*
  skill when you want to know "is this *transition* instant".
- [[diagnose-page-load]] — full-page orchestrator (errors → SSR → PPR).
