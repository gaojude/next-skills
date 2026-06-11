# Real-app patterns

The rest of this skill models a single linear `layout → page` tree. Production App Router routes add **parallel-route slots, shared chrome, and auth gates** — where most of the real instant-shell work happens. These patterns bridge that gap. Read the skill's `SKILL.md` and `patterns.md` first.

## Parallel routes & `@slot`s — each slot is its own boundary

Instant validation treats every parallel-route slot below the shared layout as an **independent** navigation boundary. Consequences:

- **Each `@slot` needs its own `<Suspense>`** around its dynamic reads — a boundary in one slot does not cover another.
- **An uncovered dynamic read in _any_ slot blocks the whole navigation.** `@content` being perfect doesn't help if `@sidebar` awaits a session at the top.
- **A slot that renders `null` (e.g. `default.tsx`) is shell-safe** — static, no reads. Slots you don't re-render for this nav cost nothing.

```
[tenant]/layout.tsx         (shared — already mounted on a soft nav; not re-rendered)
  ├ @content  → settings/layout → billing/page     ← guard each slot's dynamic reads…
  ├ @sidebar  → settings sidebar                    ← …here too (independent boundary)
  └ @header   → default.tsx → null                  ← free
```

## Client "slot-router" chrome stays out of the soft-nav re-render

Common pattern: a **stable** shared layout renders `@header`/`@sidebar` through a **client** component that swaps slot content by `usePathname()`. On a soft (client) navigation Next.js only re-renders the **server** segments that changed below the shared layout — a client-component subtree is not part of that server re-render. So that chrome **neither blocks the nav nor needs server `<Suspense>`** for it; only the server segments that actually change (e.g. `@content`) matter for that nav. (It _does_ participate in a full page load — see the MPA caveat below.)

## "Instant" ≠ "useful shell" — the empty-fallback trap

Validation checks that a dynamic read is **guarded by a boundary**, not that the fallback is non-empty. A `<Suspense>` with **no `fallback`** (or `fallback={null}`) **passes** validation and commits instantly — but renders a **blank** shell. If a layout and its page both `await getServerSession()` at the top under one empty-fallback boundary, the whole frame collapses into nothing while the user waits. "Validates as instant" and "good UX" are different goals.

> Give every boundary a real skeleton, and push it **low** so the most real content stays in the shell. A `fallback={null}` directly above `<body>` is a deliberate empty-shell opt-out; an empty fallback **lower** in the tree is almost always a bug.

## The responsive / mobile-drift trap — the skeleton must match every breakpoint

A real skeleton that misaligns the loaded UI is its own bug, and the place it bites is **mobile**. A hand-built skeleton encodes **one** layout; the real component is **responsive** and changes shape at breakpoints, so a desktop-shaped skeleton no longer lines up once the viewport is small.

Concrete shape we hit: a settings editor renders a sidebar **tree of rows** on desktop, but swaps the entire tree for a single `<Select>` dropdown on mobile (with its own `Loading…` state). A row-skeleton built for the desktop tree has nothing to align to on mobile.

The fix is the same push-down as everywhere else: **share the real responsive layout between the live render and the shell render.** Let one responsive component render both — its data slots show the reused `*Skeleton` in the shell and real data after the stream — so the breakpoint switch (tree ↔ dropdown) happens once, for both renders, and there is no second desktop-only skeleton to drift. If instead you hand-build a fallback that re-creates the chrome, you owe *every* breakpoint of that chrome and you will get one wrong.

Litmus: this is the same rule as "if an element renders in both the fallback and the resolved tree, hoist it above the boundary" — responsive chrome included. Verify the shell at **both** desktop and mobile width against the real render at the same width.

## Deferring an auth gate / top-level `await` in a layout

A top-level `await` in a layout gates everything below it (the #1 blocking shape, `patterns.md` #1–#2). Auth gates are the most common real instance:

```tsx
// ⛔ before — await + redirect at the top gates the whole settings frame
export default async function SettingsLayout({ children }) {
  const s = await getServerSession() // hangs in prerender → frame can't build
  if (!s?.user) redirect(getLoginUrl())
  return <TooltipProvider>{children}</TooltipProvider>
}
```

```tsx
// ✅ after — render children unconditionally; move the gate into a Suspense child
import { Suspense } from 'react'

export default function SettingsLayout({ children }) {
  return (
    <TooltipProvider>
      <Suspense fallback={null}>
        <AuthGate />
      </Suspense>
      {children}
    </TooltipProvider>
  )
}

async function AuthGate() {
  const s = await getServerSession() // session read hangs in prerender…
  if (!s?.user) redirect(getLoginUrl()) // …so redirect() never runs during prerender
  return null
}
```

The shell builds **as if authorized** — the session read hangs before `redirect()` is reached, so the redirect only happens at request-time resume — and `{children}` is now in the shell instead of behind the gate. (`fallback={null}` is correct here: `AuthGate` renders nothing on success.)

## Dev-overlay observation (optional)

Trustworthy measurement uses the prod-build rig (SKILL.md phase A; dev `instant()` lies for blocking routes). As an optional _observation_ channel while authoring, you can also iterate in the dev overlay:

1. `export const unstable_instant = true` on the target route (safe — see "Sharp edges").
2. Run `next dev` with `experimental.instantInsights.validationLevel: 'warning'` (or higher) and `experimental.instantNavigationDevToolsToggle: true`.
3. Navigate to the route; read the **Insights / Instant tab** in the dev overlay — each entry is an uncovered dynamic read with its source frame. Fix, repeat.
4. Use DevTools → **Instant Navigation Mode** to freeze the shell and _see_ what's blank.

## Testing a soft nav when there's no direct A→B link

The `test-template.md` spec clicks a `<Link>`. When B is buried (no direct link), you might reach for `page.goto(B)` inside `instant()` — but **`page.goto` is a full page load (MPA), not the soft nav**, and the two shells can differ:

> ⚠️ **MPA shell ≠ soft-nav shell when a layout _above_ the shared boundary `await`s un-enumerated `params`/`searchParams`.** A page load re-runs every layout from the root; if a parent layout does `await props.params` and that segment has no `generateStaticParams`, the param **hangs on the page load** and its whole subtree drops out of the frozen shell — so `goto`-in-`instant()` shows _less_ than the real soft nav (which doesn't re-render that parent and already has the params). Symptom: an element present after a real `<Link>` click is **missing** after `goto`.

So: to assert the **soft-nav** shell, drive a real `<Link>` click (click through the menus if needed). Reserve `page.goto(B)` inside `instant()` for asserting the **page-load** shell, or when no parent above the shared boundary awaits un-enumerated params (then the two coincide).

## Sharp edges

- **`unstable_instant = true` does not fail the build under a `warning` level.** `true` opts in at the _default_ level; only a per-route `{ level: 'experimental-error' }` or a global `experimental-*-error` level fails builds. So `true` is a safe permanent regression marker.
- **A `React.cache` (or custom memo) wrapper around `cookies()`/`headers()` still hangs.** Memoizing the call does not make it shell-safe — the underlying request read still returns a hanging promise in prerender. Only the **`use cache`** directive, keyed on static/param inputs, puts data in the shell.
- **Playwright can't "see" a `display: contents` / fragment fallback.** Such a fallback reads as _hidden_, so `instant()` assertions can't `toBeVisible()` it. Give fallbacks a real wrapper element with a `data-testid`.
