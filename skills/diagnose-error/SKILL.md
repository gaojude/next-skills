---
name: diagnose-error
description: Check whether the currently loaded page has critical errors — browser console errors, Next.js compilation issues, dev-server runtime errors, and obvious UI breakage. Use as a precondition before deeper SSR or PPR diagnosis, or standalone when the user asks "what's wrong with this page" / "is this page healthy". Assumes an agent-browser session is already on the target page.
---

# diagnose-error

Quick health check on the currently loaded page. Three signals: browser
console, Next.js MCP server, visual UI.

## Prerequisites

- Next.js 16+ dev server running (for the `/_next/mcp` step).
- An `agent-browser` session is already on the target page. Probe with:

  ```bash
  agent-browser get url    # errors if no session; prints URL if alive
  ```

  If unmet, invoke [[prep-browser-session]] first to bootstrap.

## Procedure

### 1. Browser-side errors

```bash
agent-browser errors
agent-browser console
```

Classify what you see:

| Severity | Examples | Action |
|---|---|---|
| **Critical** | Uncaught exception, hydration mismatch error, `Error: ...` thrown from a Server Component, RSC 500 in the network panel | Report and **abort** the parent diagnosis. |
| **Warning** | React dev-mode warnings, deprecation notices, missing-key warnings | Note in the report, don't abort. |
| **Noise** | Vendor analytics chatter, expected 4xx on probing endpoints | Ignore. |

### 2. Next.js dev-server state

Query `/_next/mcp` for authoritative server-side errors (configuration
+ live session errors):

```bash
DEV=${DEV:-http://localhost:3000}
mcp() {
  curl -sS -X POST "$DEV/_next/mcp" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":{}}}" \
    | sed -n 's/^data: //p'
}

mcp get_errors                  # { configErrors: [], sessionErrors: [] } → healthy
mcp get_compilation_issues      # { issues: [] }                          → healthy
```

`configErrors` non-empty → broken `next.config.*`. **Critical, abort.**
`sessionErrors` non-empty → runtime error reported from the browser
session — investigate, usually critical.
`issues` non-empty → build/transform errors. **Critical, abort.**

If the MCP endpoint 404s or refuses, the dev server isn't Next 16+;
skip this step but note it.

### 3. Visual UI sanity

Capture a full-page screenshot and eyeball it:

```bash
agent-browser screenshot --full /tmp/diagnose-error-ui.png
```

Look for: blank/white page, layout collapse, untranslated keys
(`t('foo.bar')`), runaway skeletons that never resolve, error overlays
covering the page, broken images (large gray boxes).

Anything that looks "page is broken to a human" → critical.

## Output

Report in this shape:

```
diagnose-error: <PASS|FAIL>

Browser errors: <count> critical, <count> warning
  - <one-line summary per critical>
Next.js MCP:
  configErrors: <count>
  sessionErrors: <count>
  compilation issues: <count>
UI screenshot: /tmp/diagnose-error-ui.png
  notes: <e.g. "blank page", "renders normally", "error overlay visible">
```

If `FAIL`, the caller (e.g. [[diagnose-page-load]]) should stop and
surface the report to the user before continuing.
