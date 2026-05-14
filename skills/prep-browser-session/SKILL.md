---
name: prep-browser-session
description: Bootstrap the browser session the diagnose-* skills assume — verifies the Next.js dev server is up, opens system Chrome with React DevTools enabled, and waits for the user to land on the target page (logging in interactively if needed). Use as a prerequisite when any diagnose-* skill reports no active agent-browser session.
---

# prep-browser-session

Sets up what the diagnose-* skills assume: a running dev server, a
real headed Chrome with the React DevTools hook installed, and a
session parked on the target URL. Run once per session — the leaves
share it.

## Procedure

### 1. Check the dev server

```bash
lsof -i :3000 -P -n | grep LISTEN
```

If nothing's listening, ask the user to start it. Don't auto-start —
the dev server is long-lived and the user owns the terminal. If the
server runs on a different port, get the URL and use that for `$DEV`.

### 2. Launch system Chrome with React DevTools

Drive **system Chrome**, not the Playwright-bundled testing browser
— the user wants their normal profile/fonts.

```bash
agent-browser \
  --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  open --headed --enable react-devtools about:blank
```

The `--enable react-devtools` flag is mandatory: `agent-browser react …`
needs the hook installed at launch.

If a daemon is already running with the wrong settings, `agent-browser
close` first — options aren't applied to a live session.

If `agent-browser` isn't installed: `npm i -g @vercel/next-browser &&
playwright install chromium`.

### 3. Hand off to the user

Ask via `AskUserQuestion` or a plain prompt:

> "Drive the browser to the page you want diagnosed. Log in if needed.
> Reply when you're on the target page."

Don't try to script logins.

### 4. Save state

```bash
URL=$(agent-browser get url)
agent-browser state save .claude/diagnose-state.json
```

Add `.claude/diagnose-state.json` to `.gitignore` (it contains session
cookies). On re-runs:
`agent-browser --state .claude/diagnose-state.json open "$URL"`.

## Output

The prepared starting URL. Leaves can call `agent-browser get url`
themselves at any time.

## Leaf-side probe

```bash
agent-browser get url    # errors if no session
agent-browser react suspense > /dev/null 2>&1  # errors if hook missing
```

If either fails, the leaf should re-invoke this skill. A missing
DevTools hook needs an `agent-browser close` + relaunch — the hook is
install-at-launch only.
