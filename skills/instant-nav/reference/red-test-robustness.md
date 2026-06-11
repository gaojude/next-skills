# Red-test robustness — prove the RED before you optimize

Gate C of the workflow. The most expensive mistake in this work is **optimizing against a RED that is
red for the wrong reason.** You make the route instant, the test stays red (or you contort the code
to satisfy a broken assertion), and you've spent the effort on the wrong thing. The fix is cheap:
spend a few minutes proving the RED is trustworthy _first_.

## The one question that prevents most of it

> **Does the marker render WITHOUT the lock, as the CI test user?**

- **No** → the test is red because the marker/page isn't there for that user/env — a marker bug, not
  an instancy bug. Fix the marker. (This is the overwhelmingly common case.)
- **Yes** → the marker exists and is reachable; a red _under the lock_ is a genuine "not instant".
  Now optimize the route.

Everything below is detail in service of answering that question honestly.

## The robustness checklist (all must hold)

1. **Red on baseline** — fails on the un-fixed route.
2. **Right reason** — once unlocked the marker IS visible, verified **in the CI env / as the CI test
   user**, not just on your machine as yourself.
3. **Differential** — reverting ONLY the fix → RED; re-applying → GREEN; nothing else moves it.
4. **Non-gameable marker** — a **sync** element of the static frame, never streamed data.
5. **Deterministic on prod** — stable across N runs; never `next dev` (its `instant()` leaks).
6. **Discriminating both ways** — present-under-lock on instant, absent-under-lock on blocking.
7. **Renders for the CI test user** — under that user's flags / plan / role / empty-state.
8. **Conditional redirects accounted for** — assert at the route's real destination for that user.
9. **Real selector** — `data-testid` on a known static-shell node, not a guessed `role`/`name`.
10. **Visible marker** — not `display:none` / off-screen / inside a hover overlay; for lists, target
    `.filter({ visible: true }).first()`.
11. **Fresh build under test** — the deploy you're measuring contains your latest commit, not a
    stale alias still serving the previous build.

## Taxonomy — "red for the wrong reason"

Any of these makes a RED untrustworthy. None of them is "the nav isn't instant."

| Wrong reason                 | How it sneaks in                                                                | How to disprove it                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Selector matches nothing** | guessed `getByRole('button',{name:'Folder'})`                                   | grep the component for the real accessible name; add a `data-testid`                    |
| **Conditional redirect**     | route `redirect()`s for the test user (flag/role) → marker page never reached   | check the page's top-level branches; assert at the real destination, or pin the flag    |
| **Flag / plan / role gate**  | author has the flag/plan; the CI test user doesn't                              | run the unlocked baseline as the CI user; pin flags via your override mechanism         |
| **Empty-state**              | marker only exists when there's data; CI account is empty                       | pick a marker present in the empty state (chrome/header), or seed data                  |
| **Timeout / flake**          | slow API, transient infra 500                                                   | re-run; separate infra flake from a real signal                                         |
| **Streamed marker**          | the marker is actually behind `<Suspense>` → never in the shell                 | choose a sync frame element; verify it's outside every `<Suspense>`                     |
| **Auth redirect**            | unauthenticated → `/login`                                                      | confirm login succeeded before the nav                                                  |
| **Stale deploy**             | test ran against the _previous_ build (alias not yet repointed)                 | poll the deploy for a marker from your latest commit before trusting any verdict        |
| **Hidden / off-screen**      | testid on a hover-overlay / `hidden sm:block` node, or an off-screen list item  | put the marker on an always-visible node; `.filter({ visible: true }).first()` for lists |

## Worked cases (illustrations, not the rule)

Each of these shipped during a real burn-down, failed for a wrong reason, and none was an instancy
problem. They all fail the one question above — the marker doesn't render unlocked for the CI test
user.

- **Flag-gated redirect** — marker `h1 "Design Systems"`. The page `redirect()`s to a legacy route
  when a feature flag is off; the CI user has it off, so that h1 is never the destination.
  → checks 7, 8. Fix: pin the flag for the test user, or assert the real destination.
- **Guessed selector + empty state** — marker `button "Folder"`. No element with that accessible
  name exists in the page chrome, and the CI account's library is empty. → checks 7, 9. Fix:
  `data-testid` on a real static-shell node of the chrome.
- **Plan-gated nav** — the setup couldn't even reach the target link for the test user's plan (and
  the run had transient infra 500s). → checks 7, 9 (+ rule out flake by re-running). Fix: a stable
  link/testid present for that account, and disambiguate flake.
- **Stale deploy** — a new test ran against the previous preview build (the alias hadn't repointed),
  so the old marker location was served. → check 11. Fix: verify the build under test is live (poll
  for the new marker; don't race the rebuild).
- **Hidden marker** — testid first on a `hidden sm:block` hover-overlay link, then on a card that
  was an off-screen carousel item — Playwright resolved it but reported `hidden`. → check 10. Fix:
  an always-visible node; for lists, `.filter({ visible: true }).first()`.

## Differential proof (capture in the PR)

The single most convincing artifact that the RED is real:

```
1. on the fixed branch → GREEN
2. revert ONLY the fix (the <Suspense> push-down) → RED
3. re-apply → GREEN
4. confirm no other change moved it
```

Link the two runs (or paste the toggle diff + results) in the PR description. A reviewer who sees
the differential knows the test measures the property; without it, a green test is just a green
test.

## Misconception: `instant()` is not a stopwatch

The instant test does **not** measure how _fast_ a navigation is. `instant()` gates dynamic data and
lets you assert what's in the prefetched shell; the signal is **presence, not speed**. Under the lock
a correctly-instant route's shell is simply _there_, and a blocking route's content **never** commits
no matter how long you wait. So:

- The shipped assertion is just `await expect(SHELL_MARKER).toBeVisible()` under the lock. No custom
  timeout, no `painted` boolean, no "wait a bit and see" race.
- A custom short timeout (e.g. `3000`) implies you're racing the shell against a clock — you're not.
  It adds nothing for the verdict (the blocking route times out either way) and invites flaky
  false-REDs on an instant route whose commit lands a microtask late.
- Do **not** use `locator.isVisible({ timeout })` as a "soft wait" — Playwright deprecated and
  **ignores** that timeout (`isVisible()` returns immediately). It's also simply not needed.
- "Renders for the CI test user" (checks 7–9) is proven at **authoring time** with the unlocked
  baseline scaffold — not by a timed assertion in the shipped test.

## Misconception: instant() guards need retries / prefetch warming

**An `instant()` guard is deterministic. Never configure retries on one, and never hover-warm to
"make the prefetch land in time".** Under the lock the router initiates the route prefetch and
**awaits it before committing** — even for a `prefetch={false}` link, even for a route the viewport
already cached. The committed shell does not depend on any prior render/hover/menu-open prefetch.
If a guard is flaky, the cause is real — a marker that isn't a sync node of B's shell, a
flag/role/empty-state gap for the CI user, or a genuinely blocking route — and the fix is in the
page or the marker, not a retry. The only legitimate `.hover()`/menu-open is when the **trigger
element** itself isn't in the DOM until hovered/opened, never to warm a prefetch.

## Footgun: `instant()` silently no-ops if the testing API isn't exposed

`instant()` works purely by setting a cookie (`next-instant-navigation-testing`) that the build's
lock code reads. It **never throws** when that lock code is absent — it only throws on _nested_
calls or an _unknown base URL_. So if the build was produced **without** the testing API
(`experimental.exposeTestingApiInProductionBuild`), the cookie is ignored, the navigation runs
normally, and your `instant()` test **passes vacuously** — it proved nothing. A green `instant()`
test is only meaningful if the lock actually engaged.

Two defenses (use both):

1. **Confirm the API is exposed on the target.** Gate the flag so preview/CI builds have it (e.g.
   on `VERCEL_ENV === 'preview'` or an explicit env var — see SKILL.md phase A). Never trust an
   `instant()` green from a build where it isn't set.
2. **Make the test self-validating** — for any route with deferred content, also assert that the
   deferred content is **GATED** under the lock, not just that the shell is present
   (`test-template.md`, self-validating variant). If the lock didn't engage, the content is already
   there and `toHaveCount(0)` fails — the test cannot pass vacuously.

   Caveat: the gated-content check only holds on a **fresh** (uncached) route. A warmed route
   serves the content regardless, so the `toHaveCount(0)` half passes for the wrong reason
   (vacuous). Navigate fresh, or drop the gated half.

## Determinism & the rig

- Always measure on a **prod build** (CI preview deploy, or local `next build && next start` with
  the testing API exposed — SKILL.md phase A). `next dev`'s `instant()` lock leaks for blocking
  routes and false-passes after ~5s; it is not a valid RED.
- Run the RED N times; an intermittently-red gate is not a gate. If it flakes, find out whether it's
  infra (transient 500s) or a real race before trusting either color.
