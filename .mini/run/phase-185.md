---
phase: 185
verdict: done
steps:
  - title: "Add findingsResolve/findingsReopen command"
    status: done
  - title: "Wire resolve/reopen into the CLI"
    status: done
  - title: "Update findings command help + docs"
    status: done
  - title: "Tests for resolve/reopen"
    status: done
---

# Phase 185 — report from the auto session

## What was done

Added a manual way to close/reopen individual findings, independent of a phase
link.

- **`src/commands/findings.ts`** — new `findingsResolve(ids)` / `findingsReopen(ids)`,
  both thin wrappers over a shared `findingsSetStatus(ids, target, flip)` helper.
  The helper is the answer to the core problem flagged in discussion: the store
  functions return a bare boolean that conflates "no such finding" with "already
  in that status". So each id is **looked up first** via `findFindingById` and one
  of three distinct lines is printed:
  - changed → `Finding <id> resolved.` / `reopened.`
  - already in target → `Finding <id> is already resolved./open.` (benign info)
  - missing/malformed → `No such finding: <id>` (error)
  Every id in a batch is processed (no stop-on-first-bad); the call returns
  `ok:false` (→ exit 1) only when at least one id was missing/malformed. An
  "already in state" id counts as success (idempotent). No-project guard mirrors
  `findingsAdd`; empty/whitespace-only id list returns `reason:'no-id'`.
- **`src/cli.ts`** — `findings [action]` → `findings [action] [ids...]` (variadic),
  added `resolve`/`reopen` switch cases (`process.exit(1)` on `!ok`), updated the
  unknown-action error to `add | list | resolve | reopen`, and extended the
  command `.description()`.
- **`docs/non-interactive/findings.md`** — synopsis, description bullet, options
  note, examples, and rewrote the stale "flipping to resolved is a planned
  follow-up" note to describe the two resolve paths (auto via `--from-finding` on
  `done`, manual via this command). Left `--reason` + doctor orphan-check listed
  as the remaining follow-ups (phases 186/187, now in `mini todo`).
- **`src/commands/findings.test.ts`** — new `resolve / reopen` describe block.

## Verification

- `npm run typecheck` — clean.
- `npm test` — **1234 passed** (87 files), including the 9 new resolve/reopen
  tests: happy flip both directions, idempotent no-op (already resolved / already
  open), unknown id, malformed id (`155` without `-n` suffix), mixed batch (valid
  ids still flip while an unknown one fails the exit code), no-project guard,
  no-id guard.
- Built CLI smoke test (`node dist/cli.js findings …`) confirmed the dispatch
  wiring the unit tests can't reach: variadic ids are passed through, exit codes
  are 1 on failure, and the unknown-action / no-id messages render. Used a
  guaranteed-nonexistent id (`99999-1`) so the real findings store was untouched.

## Unhappy paths covered

Empty/whitespace id list, unknown id, malformed id, write failure (defensive
error line if `flip` returns false post-check), no project — all return a
non-zero outcome with a clear message rather than a silent no-op. `reopen` shares
the store function `mini undo` uses, and its no-op-returns-false contract is
preserved, so undo's later reopen is unaffected.

## Notes / no decision record needed

No real crossroads worth an ADR — the scope (CLI-only, multi-id, pre-check for
honest messages, defer `--reason` and do/done wiring) was all settled in
`/mini:discuss` and recorded in `.mini/discuss/phase-185.md`. The two deferred
follow-ups are already filed in `mini todo`.
