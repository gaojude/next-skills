# Test template — the instant() guard

Ship **one** test: under `instant()`, assert B's static shell **shows up**. That's the whole thing.
`instant()` gates dynamic data, so a correctly-instant route commits the shell under the lock and a
blocking route doesn't. **`instant()` is NOT a stopwatch** — you are not measuring or bounding _how
fast_ anything appears, so there are no custom timeouts and no timing races (see "Misconception" in
`reference/red-test-robustness.md`). Whether you picked the _right_ marker — one that genuinely
renders for the CI test user, not flag-gated / redirected away / a guessed name — is proven at
**authoring time** with the unlocked baseline scaffold below (phase B; gate C), NOT by an extra
assertion in the shipped test.

```ts
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'
// Use whatever auth/setup helpers your e2e suite already has. The test user
// here must be the CI test user — the account the suite runs as in CI.
import { logIntoTestAccount, testUrl } from '../helpers'

// A SYNC element of B's static frame (header / action button / column header) —
// NOT data that streams in, and one that renders for the CI test user (not gated
// by a flag / plan / role / empty-state). Prefer a data-testid on a known static
// node over a guessed role/name: a guessed `getByRole('button',{name:'Folder'})`
// once shipped RED for the wrong reason — no such element existed for the CI user.
const SHELL_MARKER = '[data-testid="<b>-shell-marker"]'

test.describe('instant nav: A -> B', () => {
  test.beforeEach(async ({ page, browser }) => {
    await logIntoTestAccount(page, browser)
  })

  test('B shell paints under instant()', async ({ page }) => {
    await page.goto(testUrl('/'))
    const trigger = page.getByRole('link', { name: '<Trigger>', exact: true })
    await expect(trigger).toBeVisible({ timeout: 20000 })

    await instant(page, async () => {
      await trigger.click()
      // Under the lock dynamic data is gated — just assert the static shell
      // shows up. THAT is the instant property. Not a stopwatch: no custom
      // timeout, no `painted` boolean, no timing race. A blocking route's
      // content never commits under the lock; an instant route's shell is there.
      await expect(page.locator(SHELL_MARKER)).toBeVisible()
    })
  })
})
```

## Self-validating variant (recommended for routes with deferred content)

Also assert the deferred content is **gated** under the lock, and streams after release. This makes
a vacuous green impossible — if the lock didn't engage (testing API missing from the build), the
content is already present and the `toHaveCount(0)` fails. Only valid on a **fresh** (uncached)
route — a warmed route serves the content regardless (see the footgun in
`reference/red-test-robustness.md`).

```ts
await instant(page, async () => {
  await trigger.click()
  await expect(page.getByTestId('b-shell')).toBeVisible() // shell present
  await expect(page.getByTestId('b-content')).toHaveCount(0) // deferred data GATED
})
await expect(page.getByTestId('b-content')).toBeVisible() // streams after release
```

## Dev-loop scaffold — DON'T ship this

Before optimizing, prove the target exists with an **unlocked** (no `instant()`) check — it
disambiguates "not instant" from "marker absent for this user/env". **Run it as the CI test user**
(their flags, plan, role, data) — not just as yourself locally; local-vs-CI flag/plan drift is the
#1 false-RED. Confirm the marker is real AND reachable, then **delete it before the PR**:

```ts
test('dev-only: clicking <trigger> renders B shell (no lock)', async ({
  page,
}) => {
  await page.goto(testUrl('/'))
  const trigger = page.getByRole('link', { name: '<Trigger>', exact: true })
  await expect(trigger).toBeVisible({ timeout: 20000 })
  await trigger.click()
  await expect(page).toHaveURL(/\/<b>(\?|$)/) // confirm the real destination (no redirect away)
  await expect(page.locator(SHELL_MARKER)).toBeVisible({ timeout: 15000 })
})
```

Notes:

- Pick `SHELL_MARKER` as a **sync** element of B's frame, never streamed data. Use a `data-testid`
  on a known static node rather than a guessed role/name.
- **No timing in the assertion.** `instant()` isn't a stopwatch — just assert the shell shows up
  under the lock with a plain `await expect(marker).toBeVisible()`. Don't reach for a custom
  timeout, a `painted` boolean, or `locator.isVisible({timeout})` (its `timeout` is deprecated and
  IGNORED anyway — it returns immediately).
- Real `<Link>` click only for a soft-nav assertion; `page.goto` inside `instant()` asserts the
  page-load shell instead (see `reference/real-app-patterns.md`, the MPA caveat).
- **No retries on an instant() guard.** Under the lock the router initiates and awaits the route
  prefetch itself before committing, so the verdict does not depend on a prior hover/viewport
  prefetch landing in time. A flaky guard has a real cause — a marker that isn't a sync shell node,
  a flag/role/empty-state gap for the CI user, or a genuinely blocking route. Retries mask the
  exact regression the guard exists to catch.
- **Differential proof (capture in the PR):** revert ONLY the fix → RED; re-apply → GREEN; nothing
  else moves it. Link both runs. See `reference/red-test-robustness.md`.
