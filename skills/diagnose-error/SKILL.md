---
name: diagnose-error
description: Check whether the currently loaded page has critical errors — browser console, Next.js compile/runtime errors, and obvious UI breakage. Use as a precondition before SSR or PPR diagnosis, or standalone when asking "what's wrong with this page" / "is this page healthy".
---

# diagnose-error

Quick health check. Three signals: browser console, Next.js MCP
server, visual UI.

## Prerequisites

- Next.js 16+ dev server (for the `/_next/mcp` step).
- agent-browser session on the target page. If unmet, invoke
  [[prep-browser-session]].

## Procedure

### 1. Browser errors

```bash
agent-browser errors
agent-browser console
```

Classify:
- **Critical** — uncaught exceptions, hydration mismatch errors,
  errors thrown from a Server Component, RSC 500s. Abort.
- **Warning** — React dev-mode warnings, deprecation notices. Note,
  don't abort.
- **Noise** — vendor analytics chatter, expected 4xx probes. Ignore.

### 2. Next.js MCP

`/_next/mcp` reports authoritative server-side errors:

```bash
DEV=${DEV:-http://localhost:3000}
mcp() {
  curl -sS -X POST "$DEV/_next/mcp" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":{}}}" \
    | sed -n 's/^data: //p'
}
mcp get_errors                # configErrors + sessionErrors
mcp get_compilation_issues    # build/transform errors
```

Any non-empty `configErrors`, `sessionErrors`, or `issues` → critical.

If `/_next/mcp` 404s, the dev server isn't Next 16+. Skip and note.

### 3. Visual sanity

```bash
agent-browser screenshot --full /tmp/diagnose-error-ui.png
```

Look for: blank page, layout collapse, untranslated `t('foo.bar')`
strings, runaway skeletons, error overlays, broken images. Anything
that looks "broken to a human" → critical.

## Output

```
diagnose-error: <PASS|FAIL>

Browser errors: <N> critical, <N> warning
  - <one-line per critical>
Next.js MCP:
  configErrors:        <N>
  sessionErrors:       <N>
  compilation issues:  <N>
UI screenshot: /tmp/diagnose-error-ui.png
  notes: <e.g. "blank page", "renders normally", "error overlay">
```

If `FAIL`, the caller should stop and surface the report before
continuing to deeper diagnoses.
