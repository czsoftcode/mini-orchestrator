# Phase 185 — Manually close individual findings

**Goal:** Add 'mini findings resolve <id>' and 'mini findings reopen <id>' CLI subcommands that wrap the existing resolveFinding/reopenFinding store functions, so any single finding can be closed or reopened independently of a phase link.

## Steps
- [done] Add findingsResolve/findingsReopen command
- [done] Wire resolve/reopen into the CLI
- [done] Update findings command help + docs
- [done] Tests for resolve/reopen

## Auto-commit
- Phase 185: Manually close individual findings

## Discussion
# Phase 185 — Manually close individual findings

## Intent
Give the user a manual way to close (and reopen) individual findings from the
`.mini/findings/` store, independent of a phase link. Today a finding is only
ever resolved automatically on `done` when the whole phase was linked via
`--from-finding`; there is no way to close a finding that a multi-fix phase
addressed, or to dismiss a "won't fix" nit. The store already has the mechanism
(`resolveFinding`/`reopenFinding`) — only the CLI surface is missing.

Scope is intentionally narrow: **CLI subcommands only, no data-model change, no
workflow wiring.** Two deliberately deferred follow-ups (to be filed in
`mini todo`):
- **186** — robustify metadata parsing (fixes open findings 160-3/160-2: parsing
  is order-locked and silently downgrades unknown values), then add an optional
  `--reason` to record *why* a finding was closed.
- **187** — decide and wire closing into the `do`/`done` lifecycle (e.g. offer to
  close additional open findings at the `done` checkpoint).

## Key decisions
- Add `mini findings resolve <id...>` and `mini findings reopen <id...>` — thin
  CLI wrappers over the existing store functions.
- **Multiple ids** accepted in one call; process each and report per-id.
- **Honest, distinct feedback per id.** The store boolean conflates "no such
  finding" with "already in target status". The command must therefore look the
  finding up first (`findFindingById`) and distinguish three outcomes:
  - changed → "resolved"/"reopened",
  - already in target status → benign no-op message (not an error),
  - not found / malformed id → error.
- **Exit code:** non-zero if any id was not found / malformed; an "already
  resolved/open" id counts as success (idempotent).
- **No `--reason`, no Finding field change** in this phase (deferred to 186 so it
  lands on a fixed parser, not the current fragile one).
- **No `do`/`done` wiring** in this phase (deferred to 187).

## Watch out for
- `resolveFinding`/`reopenFinding` return `false` both for "not found" and
  "already that status" — do NOT surface a bare boolean; pre-check with
  `findFindingById` to give an honest message and exit code.
- Malformed id (e.g. `155` without the `-n` suffix) → `findFindingById` returns
  null → treat as not-found error, don't crash.
- `reopenFinding` is already called by `mini undo`; manual reopen must not break
  undo's later no-op reopen (returning `false` on no-op is fine).
- Keep the no-project guard consistent with `findingsAdd` (warn + hint, exit 1).
- Multiple ids: a partial mix (some valid, some not) must report every id and
  set the aggregate exit code from any failure — no silent stop on first bad id.
- Tests for the unhappy paths, not just the happy flip: already-resolved no-op,
  unknown id, malformed id, mixed multi-id batch, no project.

## Run report
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
