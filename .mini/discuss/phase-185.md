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
