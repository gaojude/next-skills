---
name: locate-route
description: Identify the exact files that render the URL currently open in the agent-browser session — the layout chain, page entry, and error/not-found boundaries — via Next.js's `/_next/mcp` HTTP endpoint. Use when a skill needs to grep or read the *right* files (e.g. checking layout-level data access for PPR) instead of guessing from the URL or scanning every layout in the repo.
---

# locate-route

Given an agent-browser session parked on some URL, ask the Next.js
dev server which files actually serve that route. This is the
authoritative answer — it respects `(group)` folders, parallel routes
(`@slot`), middleware rewrites, and intercepting routes, none of
which can be derived reliably from the URL alone.

## Prerequisites

- Next.js 16+ dev server (exposes the MCP endpoint at `/_next/mcp`).
- agent-browser session on the target page. The Next.js server only
  reports route segments for URLs that are *currently rendered* in a
  connected browser. If unmet, invoke [[prep-browser-session]].

## Procedure

### 1. Reuse the `mcp()` curl helper

```bash
URL=$(agent-browser get url)
DEV="${URL%/*}"; DEV="${DEV%/}"       # origin of the loaded page
[ -z "$DEV" ] && DEV="$(echo "$URL" | sed -E 's#^(https?://[^/]+).*#\1#')"
mcp() {
  curl -sS -X POST "$DEV/_next/mcp" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":{}}}" \
    | sed -n 's/^data: //p'
}
```

Hit the MCP on the **same origin** the browser is on, not whatever
port the Next.js project "really" runs on. Middleware-rewritten URLs
land on a different upstream server, and `/_next/mcp` proxies along
with the page.

### 2. Pull project root + page segments

```bash
mcp get_project_metadata    # → { "projectPath": "...", "devServerUrl": "..." }
mcp get_page_metadata       # → { "sessions": [ { "url", "routerType", "segments": [...] } ] }
```

`segments[]` entries each have:
- `path` — repo-relative path (e.g. `app/(group)/foo/page.tsx`)
- `type` — `layout` | `page` | `boundary:error` | `boundary:not-found` | `boundary:global-error` | …
- `isBuiltin` — `true` for Next.js-injected boundaries (`global-error.js`, `not-found.js`); skip these.

If `sessions` is empty, the browser isn't connected to this dev
server. Re-run [[prep-browser-session]] or check that `agent-browser
get url` points at the same origin.

If multiple `sessions` exist (multi-tab), match on `url`.

### 3. Resolve to absolute paths

```
absolute_path = projectPath + "/" + segments[i].path
```

The `projectPath` from `get_project_metadata` is the **app root**
(e.g. `/repo/chat`), not the monorepo root. Concatenate before
handing paths to `grep`, `Read`, or `Edit`.

### 4. Order layouts parent → leaf

`get_page_metadata` returns layouts in **leaf → root** order
(deepest first). Reverse before reporting, since "the parent chain"
is more readable top-down:

```bash
# layouts as returned: [scope]/layout.tsx, (dynamic-root)/layout.tsx
# layouts top-down:    (dynamic-root)/layout.tsx, [scope]/layout.tsx
```

## Output

```
locate-route: <PASS|FAIL>

URL:      <url>
Project:  <absolute projectPath>
Router:   <app|pages>

Layouts (parent → leaf):
  - <relative path>
  - <relative path>

Pages:
  - <relative path>            # multiple entries when parallel routes are in use
  - <relative path>

Boundaries:
  - error:     <relative path>          (or "none")
  - not-found: <relative path>          (or "none")
```

`FAIL` when `sessions` is empty or `/_next/mcp` 404s — callers should
stop and surface the message rather than guess the route.

## Gotchas

- **Built-in boundaries.** `global-error.js` and `not-found.js` with
  `isBuiltin: true` are Next.js fallbacks, not files in the repo.
  Don't try to `Read` them.
- **Parallel routes (`@slot`) produce multiple page entries.** A
  single URL can render N `page.tsx` files in parallel; report all of
  them. Layout-await checks should run against all of them too.
- **Rewrites move the route under a different segment than the URL
  suggests.** The MCP reports the *served* route, which is what you
  want; the URL bar is just a label.
- **`get_routes` is the wrong tool here.** It enumerates every entry
  point in the filesystem. `get_page_metadata` is scoped to the
  currently loaded URL — that's the one you want.

## Related

- [[diagnose-ppr]] — layout-await checks should run against the
  layouts this skill returns, not `app/**/layout.tsx`.
- [[diagnose-error]] — uses the same `/_next/mcp` curl pattern for
  `get_errors` / `get_compilation_issues`.
