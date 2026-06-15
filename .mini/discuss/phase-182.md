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
