# Phase 182 — Stabilize status tests under color

**Goal:** Disable ANSI colors globally in the vitest test setup (e.g. via NO_COLOR before picocolors loads) so npm test is deterministic regardless of the ambient CI env var, fixing the two status.test.ts assertions that break on GitHub Actions where picocolors auto-enables color.

## Steps
- [done] Add NO_COLOR to vitest.config.ts test.env
- [done] Verify the fix under simulated CI
- [skipped] Fallback to setupFiles only if test.env is too late
- [done] Confirm no regressions: statusline + plain run + build

## Auto-commit
- Phase 182: Stabilize status tests under color

## Discussion
# Phase 182 — Stabilize status tests under color

## Intent
CI on GitHub Actions fails on `npm test` (has been red since ~phase 172), not because
of a production bug but because of two environment-fragile assertions. GitHub Actions
sets `CI=true`; picocolors treats the `CI` env var as "color supported" and turns ANSI
colors ON even without a TTY. In `renderPhaseDetail`, the phase title is wrapped in
`pc.bold(title)`, so with colors on the rendered line is `2. \x1b[1mTarget phase` — the
escape codes split the literal substring and `out.toContain('2. Target phase')` fails.
Locally (no `CI` env) colors are off, so it passes. The fix: make test output
deterministic by disabling picocolors colors globally in the test run.

Exactly 2 tests fail, both in `src/commands/status.test.ts`:
- `renderPhaseDetail > renders the header, goal, steps with their detail, and the run report` (asserts `'5. Some phase'`)
- `status --phase (integration) > existing phase prints its detail, steps and run report body` (asserts `'2. Target phase'`)

Reproduce locally with `CI=1 npm test`. Confirmed fix: `CI=1 NO_COLOR=1 npx vitest run ...` → green.

## Key decisions
- Mechanism: set `NO_COLOR` in **`vitest.config.ts` via `test.env: { NO_COLOR: '1' }`**
  (user's explicit choice). Declarative, applies regardless of how tests are launched
  (`npm test`, IDE, `npx vitest`) — unlike an npm-script prefix which would miss IDE/direct runs.
- Scope is tight: only the global color toggle. Do NOT also rewrite the two assertions to
  strip ANSI — the global toggle is the agreed single fix. Accepted trade-off: with colors
  globally off in tests, no test exercises the picocolors colored branch.
- The two failing assertions are left as-is (plain-substring), now valid because output is plain.

## Watch out for
- **Import-time evaluation (main risk):** picocolors decides `isColorSupported` at module
  IMPORT time. `test.env` is applied at worker startup before the test module graph loads,
  so it *should* take effect before picocolors is imported — but `do` MUST verify this
  empirically (run `CI=1 npm test` and confirm both tests pass), not assume it. If `test.env`
  proves too late, fallback is a `setupFiles` entry that sets `process.env.NO_COLOR` before imports.
- `src/statusline/render.test.ts` asserts the PRESENCE of raw ANSI codes (e.g.
  `usageColor(0) === '\x1b[32m'`). These are **hardcoded escape constants in
  `src/statusline/render.ts` (NOT picocolors)** — `NO_COLOR` does not affect them, so these
  tests stay green. Verified: status + statusline pass together under `CI=1 NO_COLOR=1`.
  Do not "helpfully" make statusline honor NO_COLOR — out of scope and would break those tests.
- Verification gate: the real check is `CI=1 npm test` (full suite) green, plus a plain
  `npm test` still green. Local `npm test` alone is NOT sufficient — it never had `CI` set,
  which is exactly why this slipped through.
- Out of scope: the CI log's `actions/checkout@v4` Node-20 deprecation is a warning, not the
  failure cause — leave the workflow file alone.

## Run report
---
phase: 182
verdict: done
steps:
  - title: "Add NO_COLOR to vitest.config.ts test.env"
    status: done
  - title: "Verify the fix under simulated CI"
    status: done
  - title: "Fallback to setupFiles only if test.env is too late"
    status: skipped
  - title: "Confirm no regressions: statusline + plain run + build"
    status: done
---

# Phase 182 — report from the auto session

## What was done
Added `env: { NO_COLOR: '1' }` to the `test` block in `vitest.config.ts` (with an
English comment explaining the CI=true / picocolors interaction). This forces ANSI
colors off for the whole test run regardless of the ambient environment, so output
is deterministic.

## Verification (all mechanical, done here)
- **The main risk is resolved.** `test.env` IS applied before picocolors evaluates
  `isColorSupported` at import time — `CI=1 npm test` now passes all 1212 tests
  (previously the two `status.test.ts` assertions failed because `CI=true` made
  picocolors split literal substrings like `2. Title` with bold escapes).
- Plain `npm test` (no CI env): 1212 passed — no regression on the path that was
  already green.
- `src/statusline/render.test.ts` under `CI=1 NO_COLOR=1`: 16 passed. Confirmed as
  predicted — statusline uses **hardcoded** ANSI constants, not picocolors, so
  NO_COLOR doesn't touch it.
- `npm run typecheck`: clean. `npm run build`: succeeds.

## Notes
- **Step 3 (setupFiles fallback) was skipped on purpose** — it was a conditional
  safety net for the case where `test.env` applied too late. Step 2 proved that
  didn't happen, so the simpler `test.env` mechanism stands; no `setupFiles` added.
- Accepted trade-off (from discussion): with colors globally off in tests, no test
  exercises the picocolors colored branch. The two failing assertions were left
  as-is (plain substrings), now valid.
- Out of scope, untouched: the CI log's `actions/checkout@v4` Node-20 deprecation
  warning — it's a warning, not the failure cause.
- Reminder: this fix only becomes "real" once it's pushed and the GitHub Actions run
  goes green; locally it's reproduced via the `CI=1` prefix.
