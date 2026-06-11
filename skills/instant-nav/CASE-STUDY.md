# Case study: an agent made v0's PPR shell real

How we turned "optimize the PPR shell" into a verifiable e2e test, and let a
long-running coding agent loop against CI until it went green. This is the
companion to `SKILL.md`: the skill is the _how_, this is what happened when we
pointed an agent at the hardest page in the app.

PR numbers below refer to v0's private repository — they're cited as evidence,
not links you can follow. Everything else is reproducible in any Next.js app
with Cache Components.

## The problem

v0 had PPR enabled. The logged-in home still served an empty `<body>` on a
hard load.

Nobody noticed for months. The page eventually rendered, so nothing looked
broken. But the static shell — the entire point of PPR — wasn't there. Every
hard load paid full dynamic render time before the user saw anything.

"Optimize the PPR shell" is a real engineering task. It is also a terrible
agent prompt. There's no definition of done. The agent can move some
`<Suspense>` boundaries, see no errors, and declare victory. You can't review
your way out of that — the failure is only observable in a prod build, under
specific timing, as a logged-in user.

## The formulation

So we didn't ask for an optimization. We wrote a test that encodes the
user-visible promise, watched it fail, and asked the agent to make it green.

The promise: *a hard load of the home serves a static shell with a working
composer — and a prompt you start typing before the page finishes hydrating
survives all the way to the chat API.*

The test (abridged from `instant-home-load.spec.ts`, vercel/v0#25041):

```ts
await instant(
  page,
  async () => {
    await page.goto(homeUrl)
    const input = page.locator(INPUT).first()
    await input.click()
    await input.pressSequentially('1+', { delay: 20 })
  },
  { baseURL },
)

// lock released — dynamic data resumes, hydration completes
await page.locator(INPUT).first().pressSequentially('1', { delay: 20 })
await promptPrimaryActionButton(page).first().click()

const body = await postedChatRequest
expect(body).toContain('1+1') // typed across the hydration boundary
```

One assertion, five properties it forces:

1. The document is a real static PPR shell (otherwise nothing renders under
   the `instant()` lock).
2. The composer is **in** the shell, not behind a dynamic boundary.
3. The shell hydrates without a mismatch (a hydration error remounts the
   subtree and drops the `1+`).
4. The send button works without waiting on deferred per-request data.
5. The submit pipeline accepts the prompt end to end.

You cannot game this test by wrapping things in `<Suspense fallback={null}>`.
You cannot pass it with a shell that renders but eats your keystrokes. That's
the whole trick: the test is the spec.

## The ruler: `instant()`

The test is only writable because of `@next/playwright`'s `instant()` helper
([Andrew Clark's](https://github.com/acdlite) instant-navigation testing work
in Next.js). `instant()` is a lock, not a stopwatch. It gates dynamic data and
freezes the world so you can assert what's in the static shell — presence, not
speed. Under the lock, an instant route's shell is simply *there*, and a
blocking route's content *never* commits, no matter how long you wait. That
makes the verdict deterministic, which is what lets a machine consume it.

This property is load-bearing. An agent looping unattended cannot interpret "it
feels slow". It can interpret RED and GREEN — if and only if RED and GREEN are
trustworthy (`reference/red-test-robustness.md` is the catalog of ways they
lie).

## The loop

With the test in place, the agent's job collapsed to a single verifiable loop,
running on the same infrastructure every PR already uses:

```
push code → CI builds the preview deploy → run the e2e against the preview
        ↑                                                       │
        └────────────── read the failure, fix ──────────────────┘
```

No special harness. The preview deploy is the rig: a real prod build, real
env, testing API exposed (`experimental.exposeTestingApiInProductionBuild` —
v0 gates it on `VERCEL_ENV === 'preview'`; any CI that produces a runnable
prod build per push closes the same loop, and the skill's setup phase records
what that looks like in your repo). Each iteration costs a CI build, so the
loop is slow — minutes per turn, hours end to end. That's fine. It runs
without a human watching.

This only became practical with long-horizon agents (we ran Claude
Mythos-class models). The shipped work took dozens of round trips:
vercel/v0#25041 landed after 9 loop iterations; its successor
vercel/v0#25101 — extending the shell to every team scope and hardening
hydration — took 38. No human sat through those builds.

## What the agent actually found

The payoff wasn't generated boilerplate. It was root-caused bugs — each one
found because a loop iteration turned a vague symptom into a concrete failure.
All of these shipped in vercel/v0#25041 and #25101:

- **One line was disabling PPR for the entire logged-in app.** A `Date.now()`
  inside a client `useMemo` in a shared data provider. Under Cache Components
  that's an unstable value, which silently bails the route out of its static
  shell — and the provider wrapped every logged-in route. Fix: `useId()`. This
  is the empty-`<body>` mystery, and no one had found it by reading code.
- **Cookie reads during the first render broke hydration.** The persisted-state
  provider read client cookies synchronously while hydrating, diverging from
  the build-time prerender. React #418, subtree regenerated, pre-hydration
  keystrokes dropped. Fix: render server state first, apply client state after
  mount.
- **Keystrokes typed before hydration never reach React.** No `onChange` has
  mounted yet. Fix: a pre-hydration inline script persists them to the local
  draft, which is restored on mount. (This is what makes the `1+` in the test
  survive.)
- **The send button waited on data it didn't need.** It was gated on a deferred
  per-request `user` promise; the server authenticates from the session cookie
  anyway. Under the lock — and on slow connections — the composer was
  permanently unsubmittable. Fix: remove the gate.
- **Submitting from the shell triggered an unbounded refetch loop.** A rewrite
  header meant for server actions was also applied to plain RSC refetches,
  bouncing the new chat between a redirect and a rewrite — the trace showed
  the same chat refetched 44 times. Fix: gate the header on `next-action`.
- **Reading the `[scope]` route param discarded the shell for teams.** Awaiting
  a non-enumerated dynamic param makes the page wait for the request (the
  fallback-route bug class, `SKILL.md` phase D). Fix: derive what the shell
  needs from always-known root params; resolve the real scope where it doesn't
  block.
- **The server and client disagreed on the pathname.** The shell renders an
  internal rewrite path; the client sees the public URL. Every component that
  derived UI from `usePathname()` — sidebar highlight, active tabs — mismatched
  on hydration and kept the wrong value. Fix: one `usePublicPathname()` that
  both sides agree on.

None of these is an "AI-shaped" change. They're the bugs a careful engineer
would find with unlimited patience and a deterministic repro. The test
supplied the repro; the agent supplied the patience.

The result, verified against the preview: a hard load of the logged-in home
serves a ~79KB static shell with an interactive composer, the typed prompt
survives hydration into the chat API request body, and the e2e guards it in CI
from then on.

## Why the formulation is the unlock

The model matters — this wasn't practical before long-horizon agents. But the
capability is conditional on the problem formulation. Three properties did the
work:

1. **A machine-checkable definition of done.** Not "make it faster" —
   *this test, green, on the preview deploy*. The agent never negotiates with
   a vibe.
2. **A trustworthy verdict.** A RED that's red for the wrong reason sends the
   agent optimizing a route that was never broken; a vacuous GREEN (lock never
   engaged, stale deploy) ends the loop with nothing shipped. Humans waste an
   afternoon on these; an unattended agent wastes the whole run. The
   PROVE-RED gate and the self-validating test shape exist exactly for this.
3. **A loop the agent can drive itself.** Push, wait for CI, run the e2e, read
   the failure. Every piece already existed for humans; the agent just runs it
   more times than a human would tolerate.

## Where this goes

`instant()` made one constraint — "this page is a static shell and stays
interactive through hydration" — cheap to assert. The pattern generalizes:
every constraint you can turn into a deterministic e2e verdict becomes a
constraint an agent can be left alone to satisfy.

That's the investment thesis: more verification primitives. Build-time
validation that enumerates every blocking route (`instantInsights`). Runtime
locks like `instant()` for other invariants — hydration cleanliness, suspense
boundary placement, view transitions. Each one converts a class of "optimize
X" requests into "make this test green" — which, as this burn-down showed, is
a problem agents can now actually finish.
