---
name: prep-browser-session
description: Bootstrap a real browser session that the diagnose-* skills can build on — verifies the Next.js dev server is up, opens system Chrome with React DevTools enabled, and waits for the user to land on the target page (logging in interactively if needed). Use as a prerequisite when any diagnose-* skill reports no active agent-browser session, or directly when you want to prep an environment without running diagnostics. Invoked automatically by [[diagnose-page-load]] and referenced by [[diagnose-error]], [[diagnose-ssr]], [[diagnose-ppr]], [[diagnose-instant-nav]] as their precondition.
---

# prep-browser-session

Sets up the world the diagnose-* skills assume: a running dev server,
a real headed Chrome with the React DevTools hook installed, and a
session parked on whatever URL the user wants to investigate.

This skill exists so leaf diagnoses (`diagnose-error`, `diagnose-ssr`,
`diagnose-ppr`, `diagnose-instant-nav`) can be invoked standalone
without re-implementing the bootstrap. If you've already run it (or
[[diagnose-page-load]], which calls it), you don't need to re-run it
between leaves — the session persists.

## When to invoke

- Any diagnose-* skill detects no active `agent-browser` session and
  references this skill in its prerequisites.
- A user wants to prep the environment ahead of ad-hoc browser work
  without running a full diagnosis.
- The previous session was closed (`agent-browser close`) and the
  React DevTools hook needs to be re-installed.

You do **not** need to run this when bouncing between leaf diagnoses
on the same session — Chrome stays open and the hook persists.

## Procedure

### 1. Ensure the dev server is running

Check the project's dev port (usually 3000). If nothing is listening,
ask the user to start it — don't auto-start; the process is
long-lived and the user owns the terminal:

```bash
lsof -i :3000 -P -n | grep LISTEN
```

If the server runs on a non-standard port, ask the user for the URL.
Keep that URL handy as `$DEV` for downstream skills.

### 2. Open headed system Chrome with React DevTools

Drive **system Chrome**, not the bundled Chromium-for-Testing — the
user dislikes the testing browser and wants their normal profile/fonts
to match real users. Pass `--executable-path` as a **global flag
before the subcommand**:

```bash
agent-browser \
  --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  open --headed --enable react-devtools about:blank
```

The `--enable react-devtools` flag is mandatory: PPR and instant-nav
diagnoses call `agent-browser react …`, which needs the DevTools hook
installed at launch. Land on `about:blank` so the user can drive from
there.

If a daemon is already running with the wrong binary, run
`agent-browser close` first — option changes are ignored on a live
session. You can also set `AGENT_BROWSER_EXECUTABLE_PATH` in the shell
env to avoid passing the flag every time.

### 3. Human-in-the-loop: navigate / log in

Ask the user (via `AskUserQuestion` or plain prompt):

> "Drive the browser to the page you want diagnosed. If this is a
> logged-in page, log in now. Reply when you're on the target page."

For logged-in flows the user performs login interactively — don't try
to script credentials.

### 4. Capture starting state

Once the user confirms, record the URL and save browser state so a
re-run can skip the login dance:

```bash
URL=$(agent-browser get url)
agent-browser state save .claude/diagnose-state.json
```

Add `.claude/diagnose-state.json` to `.gitignore` if not already (it
contains session cookies). On re-runs, reload via
`agent-browser --state .claude/diagnose-state.json open "$URL"`.

## Output

Returns the prepared starting URL (`$URL`) to the caller. The caller
can `agent-browser get url` themselves at any time — the URL isn't
stashed anywhere magical.

## Verification recipe (for leaves)

A leaf skill can probe whether prep has already run with:

```bash
agent-browser get url    # errors if no session; prints URL if alive
```

If that fails, the leaf should invoke this skill before continuing.
If it succeeds and the React DevTools hook is needed but missing
(`agent-browser react suspense` errors with "DevTools hook not
installed"), run `agent-browser close` and re-invoke this skill to
relaunch with the flag.

## Related

- [[diagnose-page-load]] — full-page orchestrator; calls this skill
  first, then chains the diagnostic leaves.
- [[diagnose-error]], [[diagnose-ssr]], [[diagnose-ppr]],
  [[diagnose-instant-nav]] — leaf diagnoses that depend on this prep.
