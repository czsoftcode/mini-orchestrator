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
