---
name: instant-nav
description: Make a Next.js navigation (or hard load) instant under Cache Components / PPR, and prove it with @next/playwright instant(). Use when asked to make an A→B navigation render instantly (or "instantify" a route), fix a route whose static shell isn't prefetched or served, or write the instant() e2e guard for one. Covers the prod-build measurement rig, the RED-test trustworthiness gate, the compose-don't-curtain fix patterns, and the parity check that the refactor changed only the instancy.
---

# Instant nav — make a navigation instant (and prove it)

Take one navigation `A → B` from "not instant" to "instant", and prove it with
`@next/playwright`'s `instant()`. **Work the phases A → G in order.** Each ends
in a gate you pass before the next. The fix recipes live in two lazily-read
docs — `reference/patterns.md` (before→after fix for every blocker type) and
`reference/real-app-patterns.md` (parallel slots, auth gates, soft-nav vs
page-load, the blank-shell and mobile-drift traps). Read one only when its
phase points you there.

## Goal

Maximize B's **static shell**: the most meaningful prerendered chrome commits
immediately on the nav; only genuinely per-request data streams after. The
metric is **present ∧ instant ∧ non-blank** — `instant()` green alone is not
the goal, because a blank `fallback={null}` shell passes too (the blank-shell
trap, `reference/real-app-patterns.md`). And the refactor must change *only*
that one property — nothing about what B renders (phase E).

`instant()` is the **ruler**, not a stopwatch — you assert the shell *shows
up* under the lock, you do not time it. A trustworthy ruler needs a **prod
build** (phase A); `next dev`'s `instant()` lies for blocking routes
(false-passes after ~5s).

## The workflow — copy this checklist, check off as you go

```
- [ ] A  RIG          prod build + testing API exposed                         → below
- [ ] B  BASELINE     unlocked: marker renders for the CI test user            → test-template.md
- [ ] C  RED          locked instant(): shell does NOT commit = the gap        → test-template.md
- [ ] C-gate PROVE-RED   the RED is trustworthy (the one question)   ⛔ STOP   → reference/red-test-robustness.md
- [ ] D  FIX          compose, don't curtain — push each boundary to its I/O   → reference/patterns.md
- [ ]      D1 reuse the page's EXISTING loading UI; never hand-build a skeleton
- [ ]      D2 the shell matches the real render at every breakpoint (mobile too)
- [ ] E  PARITY       refactor changed ONLY the instancy — verify nothing else
- [ ] F  DIFFERENTIAL revert-only-fix → RED; re-apply → GREEN                  → reference/red-test-robustness.md
- [ ] G  REVIEW       PR checklist (below)
```

Phases B–C build the test; only the locked test (C, minus the dev-only
baseline) ships.

---

## A — RIG: a prod build with the testing API exposed

`instant()` works by setting a cookie that lock code **inside the build**
reads. Two consequences:

1. **Never measure on `next dev`.** Its lock leaks for blocking routes and
   false-passes after ~5s. Not a valid RED or GREEN.
2. **The build must expose the testing API**, or `instant()` silently no-ops
   and the test passes **vacuously** (see the footgun in
   `reference/red-test-robustness.md`). Enable
   `experimental.exposeTestingApiInProductionBuild` in `next.config.ts` —
   gate it so it never reaches real production, e.g.:

   ```ts
   experimental: {
     exposeTestingApiInProductionBuild:
       process.env.VERCEL_ENV === 'preview' ||
       process.env.EXPOSE_TESTING_API === '1',
   }
   ```

The best rig is your **CI preview deploy**: push → CI builds with the real
env → run the e2e against the preview URL. It has none of the local-build
walls (missing secrets, server-only imports), and it is the same loop an
unattended agent can drive: push, wait for the build, run the test, read the
failure, fix, push again. For fast local iteration: `next build && next start`
with the flag set.

One caveat with the CI loop: verify the build under test is actually live
before trusting a verdict — a test run against the *previous* deploy reads as
a false RED (or false GREEN). Poll the deploy for a marker from your latest
commit; don't race the rebuild.

## B — BASELINE (unlocked) — dev-loop scaffold, don't ship

Click the real A→B `<Link>` with **no** `instant()` lock and assert B's
`SHELL_MARKER` renders **as the CI test user** — their flags, plan, role, and
empty-state. This proves the marker is real *and* reachable: not flag-gated,
not redirected away, not a guessed selector. Run it as the CI test user, not
just yourself locally — local-vs-CI flag drift is the #1 false-RED. Scaffold +
run command → **`test-template.md`**. **Delete this baseline before the PR.**

## C — RED (locked) + the PROVE-RED gate

Wrap the same click in `instant()`; assert the shell commits under the lock.
RED here is the gap. **This is the test that ships** → **`test-template.md`**.

> ⛔ **Gate C — do not start optimizing until the RED is proven trustworthy.**
> A RED that is red for the wrong reason sends you optimizing something that
> was never broken — the single most expensive mistake in this work. Spend the
> few minutes here.

**The one question that settles it:** *does `SHELL_MARKER` render WITHOUT the
lock, as the CI test user?*

- **No** → it's a **marker/env bug** (flag-gated redirect, guessed
  `role`/`name`, empty-state, or the marker is itself streamed). Fix the
  marker, **not the route**. Answer the question by re-running phase B as the
  CI test user — not by adding timing or extra assertions to the shipped test.
- **Yes** → the marker is real and reachable; a RED *under the lock* is a
  genuine instancy gap. Proceed to D.

The full false-RED taxonomy, the trustworthiness checklist, and worked cases
(flag-gated redirect, guessed selector, plan-gated nav, stale deploy,
hidden/off-screen marker) live in **`reference/red-test-robustness.md`**. Read
it now.

---

## D — FIX: compose, don't curtain

**The curtain (the lazy fix):** one coarse `<Suspense>` high in the tree with
a top-level fallback. Three costs: it keeps the chrome *out* of the static
shell (only a throwaway copy is prerendered); it swaps the *whole* subtree on
resolve (client state in the chrome is discarded; the real chrome
flashes/shifts in); and the hand-built fallback *drifts* as the UI changes,
because it duplicates structure that also lives in the resolved tree.

**The discipline:** hoist the static, sink the Suspense. Make the static shell
the **composer** — chrome renders once, synchronously, in the shell — and push
each boundary **down to the single I/O it actually guards**, so only that leaf
streams and the stable ancestor is reused as-is. The tree itself *is* the
loading state; there is no separate skeleton to keep in sync.

**Litmus test:** if an element renders in *both* the fallback and the resolved
tree, you've recreated the shell — hoist it *above* the boundary.

### The #1 bug class: a top-level `await` in a layout on a fallback route

```
app/[locale]/(app)/[tenant]/dashboard/...
       │ generateStaticParams ✓   │ NO generateStaticParams → FALLBACK
```

When **any** dynamic segment in the route lacks `generateStaticParams`, the
route is a **fallback route** → *all* params defer to request time, even the
enumerated ones. So a **top-level `await` in a layout** (`await params`,
`await getServerSession()`, an auth gate) blocks the whole subtree out of the
static shell — even when it reads a "statically known" param. Minimal repro:
`github.com/gaojude/next-instant-blocking-repro`.

### The fix: defer the gate, render children

Render `children` unconditionally; move the top-level `await` into a
`<Suspense>`-wrapped child. The frame prerenders as if authorized; the
deferred read hangs in prerender, so a `redirect()` only fires at request-time
resume. (`reference/real-app-patterns.md` → "Deferring an auth gate".)

```tsx
// ⛔ before — gates the whole frame out of the shell
export default async function Layout({ children, params }) {
  await requireUser(params)
  return <Shell>{children}</Shell>
}

// ✅ after — frame is in the shell; gate streams
import { Suspense } from 'react'
export default function Layout({ children, params }) {
  return (
    <Shell>
      <Suspense fallback={null}>
        <RequireUserGate params={params} />
      </Suspense>
      {children}
    </Shell>
  )
}
async function RequireUserGate({ params }) {
  await requireUser(params)
  return null
}
```

The page that consumes the shell should be **sync** (no top-level `await`),
with its dynamic data already behind `<Suspense>`. `fallback={null}` is
correct only when the gate renders nothing on success (a side effect, not
shell content). For **data**, the fallback must be a **real skeleton** — see
D1. (For every other blocker shape — `cookies()`/`headers()`, uncached
fetch/DB, dynamic params, `searchParams`, metadata — the before→after recipe
is in `reference/patterns.md`.)

### D1 — reuse the page's existing loading UI; never hand-build a skeleton

**Before you write a single line of skeleton, search the repo for the loading
UI that already exists for this page, and reuse it.** Look, in order:

1. the route's `loading.tsx`;
2. an exported `*Skeleton` next to the component (most design systems colocate
   one with each data-bearing component);
3. the fallback already inside the component's own `<Suspense>`.

If a component has no skeleton, **extract its loading markup into a colocated
skeleton beside it** — never author a fresh skeleton that mirrors the page
layout. That hand-built mirror *is* the curtain re-spelled: it's new UI that
drifts the moment the page changes, and because it's one component it pulls
you back to a single coarse boundary. Reusing the component's own skeleton
also keeps the prefetched shell matching the loaded UI exactly.

Escape hatch: if the deferred component itself renders `null` for some users
(a flag-gated control that returns `null` when off), `fallback={null}` is
right — a skeleton would flash, then collapse.

### D2 — the shell must match the real render at every breakpoint (mobile too)

A hand-built skeleton mirrors **one** layout. The real UI is **responsive** —
it changes shape at breakpoints — so a skeleton frozen to the desktop shape
misaligns the moment the viewport is mobile.

The reliable fix is the same push-down: **share the real responsive layout
between the live render and the shell render.** One responsive component
renders both — its data slots show the reused `*Skeleton` (D1) in the shell,
real data after the stream — so the breakpoint switch happens once, for both,
and there is no second desktop-only skeleton to drift. The moment you
hand-build a shell that re-creates the chrome, you owe *every* breakpoint of
it, and you will get one wrong — usually mobile. (This is the litmus test
again: chrome in both the fallback and the resolved tree → hoist it above the
boundary so it renders once, responsively.)

**Check both viewports before calling it done:** the shell at desktop width
*and* at mobile width must line up with the real render at the same width.

## E — PARITY: the refactor changed only the instancy

The push-down is a **mechanical transform, not a redesign.** After it, B must
render the *same* tree, data, ordering, empty/error states, redirects, and
interactions as before — the *only* observable difference is that B's shell
now commits instantly. Verify before shipping:

- **Same render output.** You moved `await`s into Suspense children; you did
  not change what they compute or return. After the stream, B shows the same
  content as the base branch for the test user.
- **Side effects still fire.** A deferred `redirect()` / `notFound()` still
  happens — now at request-time resume, not during prerender. Confirm an
  unauthorized user is still redirected and a missing record still 404s.
- **Both viewports reach the real UI.** Desktop and mobile both resolve to the
  real component after the stream (D2).
- **Client state survives.** Because the chrome is hoisted into the stable
  shell (not swapped on resolve), open menus, scroll, focus, and input state
  in it persist across the stream — a curtain would have discarded them.

If anything other than "it's now instant" changed, the refactor went too far —
pull it back.

## F — DIFFERENTIAL

The most convincing proof the RED measured the property: revert **only** the
fix → RED; re-apply → GREEN; confirm nothing else moves it. Link both runs in
the PR. Recipe → **`reference/red-test-robustness.md`**.

## G — REVIEW (the PR gotcha checklist)

A green final state means nothing if the RED was never trustworthy. Require:

- [ ] **Differential shown** — RED without the fix, GREEN with it (link the
      runs). No differential → not proven.
- [ ] **Marker is a sync static-shell node** (`data-testid`) — not streamed
      data, not a guessed `role`/`name`.
- [ ] **Marker renders for the CI test user** — not gated by a flag/plan/role
      CI lacks; the route doesn't `redirect()` the test user away from the
      marker page.
- [ ] **Measured on a prod build**, never `next dev`; verified against the
      build under test (deploy rebuilt after the last push, not a stale
      alias — `reference/red-test-robustness.md`, "stale deploy").
- [ ] **Marker is *visible*** — not `display:none`/off-screen; for lists
      target the first visible item via `.filter({ visible: true }).first()`
      (`reference/red-test-robustness.md`, "hidden marker").
- [ ] **Parity confirmed (phase E)** — same content/redirects/state; only the
      nav got faster.
- [ ] **Existing loading UI reused (D1)** — no new page-mirroring
      `*LoadingSkeleton`; the fallback is the component's own skeleton.
- [ ] **Shell matches real render at desktop AND mobile (D2)**.

## Soft nav vs page load

- Drive a real `<Link>` click for a soft-nav assertion, never `page.goto(B)`
  inside `instant()` — `goto` is a full page load whose shell can differ (a
  parent layout above the shared boundary re-`await`s un-enumerated params).
  The MPA-shell caveat is in `reference/real-app-patterns.md`.
- With parallel routes, only the slots that change re-render on a soft nav;
  client slot-router chrome doesn't re-render at all. Don't chase a slot the
  nav never touches — see `reference/real-app-patterns.md`.

## Files

- `test-template.md` — the shipped `instant()` spec (phase C) + the
  delete-before-PR baseline scaffold (phase B).
- `reference/red-test-robustness.md` — **gate C + phase F**: the false-RED
  taxonomy, the trustworthiness checklist, the differential recipe, the
  vacuous-green footgun, and worked cases. Read before optimizing.
- `reference/patterns.md` — before→after fix recipe for every blocker type
  (await-at-top, `cookies()`/`headers()`, uncached fetch/DB, dynamic params,
  `searchParams`, metadata).
- `reference/real-app-patterns.md` — parallel `@slot`s, deferring an auth
  gate, soft-nav vs page-load (the MPA-shell caveat), the blank-shell trap,
  the responsive/mobile-drift trap, sharp edges.
- `CASE-STUDY.md` — how this methodology let a long-running agent take a real
  app's PPR shell from an empty `<body>` to instant, unattended, by looping
  push → CI build → e2e → fix.
