# Phase 118 — CI workflow for tests and typecheck

**Goal:** Add a GitHub Actions CI workflow (.github/workflows/ci.yml) that runs typecheck, tests and build on push to main and on pull requests across Node 20 and 22, and add a CI status badge to the README.

## Steps
- [done] Add .github/workflows/ci.yml
- [done] Add CI badge to README
- [done] Wrap up and checks

## Auto-commit
- Phase 118: CI workflow for tests and typecheck

## Run report
---
phase: 118
verdict: done
steps:
  - title: "Add .github/workflows/ci.yml"
    status: done
  - title: "Add CI badge to README"
    status: done
  - title: "Wrap up and checks"
    status: done
---

# Phase 118 — report from the auto session

## What was built
- **`.github/workflows/ci.yml`** — GitHub Actions CI. Triggers on push to `main`
  and on every pull request. Matrix over **Node 20 and 22** (`fail-fast: false`),
  with `concurrency` cancel-in-progress to avoid wasted runs on rapid pushes.
  Steps: checkout → setup-node (npm cache) → `npm ci` → `npm run typecheck` →
  `npm test` → `npm run build`.
- **README CI badge** — a status badge under the title linking to the workflow runs.

## Postinstall consideration (checked)
`npm ci` runs the `postinstall` hook, but `scripts/postinstall.mjs` is guarded: it
no-ops when `dist/` is absent (the case in a fresh CI clone, since `dist/` is
gitignored), and even with a build present it only prints a hint without a TTY and
never fails the install. So **no `--ignore-scripts` is needed** and CI install is
safe. The `npm run build` step then produces `dist/` and confirms the build works.

## Verified mechanically (locally, mirroring CI)
- `ci.yml` parses as YAML (job `test`, matrix Node `[20, 22]`).
- `npm run typecheck` — clean.
- `npm test` — 68 files, **854 tests pass**.
- `npm run build` — succeeds (tsc + asset copy).

## Note for the human
The CI badge turns green only after the workflow runs for the first time on
GitHub (this push triggers it). Optionally, enable **branch protection** on `main`
in repo Settings → Branches to require the `test` checks before merging PRs — that
is a settings toggle, not a code change.
