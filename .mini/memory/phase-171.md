# Phase 171 — /mini:security slash command

**Goal:** Add an idempotent /mini:security slash command — a 'security' entry in COMMAND_DEFS plus a 'mini context security' route that reuses the existing security-review context builder and range target — mirroring /mini:adversarial-project, so the security review can be launched inline from a Claude Code session.

## Steps
- [done] Security context builder (resolve + build)
- [done] Route security in mini context
- [done] security entry in COMMAND_DEFS + usage hint
- [done] Tests
- [done] Build + run

## Auto-commit
- Phase 171: /mini:security slash command

## Run report
---
phase: 171
verdict: done
steps:
  - title: "Security context builder (resolve + build)"
    status: done
  - title: "Route security in mini context"
    status: done
  - title: "security entry in COMMAND_DEFS + usage hint"
    status: done
  - title: "Tests"
    status: done
  - title: "Build + run"
    status: done
---

# Phase 171 — report from the auto session

## What was done

Added the `/mini:security` slash command, mirroring `/mini:adversarial-project`,
so a security review can be launched inline from a Claude Code session.

- **`buildSecurityContext(cwd, input)`** in `securityReviewContext.ts` — the single
  resolve+build path: `resolveSecurityTarget` → `buildSecurityReviewContext`,
  returning `{ prompt, outputPath } | null`. The terminal `security()` command was
  refactored to consume it (it needs `outputPath` for its closing hint), so the
  resolve+build logic now lives in exactly one place and the CLI command and the
  slash route cannot drift.
- **`mini context security`** — `'security'` added to `CONTEXT_COMMANDS`; a new
  branch in `context()` calls `buildSecurityContext` and keeps only the prompt
  (the report path is embedded in it). The `prompt === null` path turns a
  range/no-phase error into a clean non-zero exit with nothing on stdout. The
  range flags were already parsed by the `mini context` CLI command, so no CLI
  arg-plumbing was needed — only the description was updated to mention `security`.
- **`security` entry in `COMMAND_DEFS`** + `/mini:security` added to the
  install-commands usage hint. The body carries the independence note and an
  extra caveat the others don't need (see below).

## A design decision worth noting

`buildSecurityContext` returns `{ prompt, outputPath }`, not just the prompt
string, specifically because the terminal `security()` needs `outputPath` for its
"read the report at …" hint. The context route uses only `.prompt`. This is the
only reason the function isn't a bare `Promise<string | null>`. Not an ADR-level
crossroads — no `/mini:decision` needed.

## Unhappy paths — what I actually checked

- **Invalid range (mixed phase + ref flags):** `mini context security
  --from-phase 1 --to HEAD` → exit 1, **empty stdout**, reason on stderr. Verified
  manually and by test.
- **No completed phase (default with only a `doing` phase):** exit 1, empty
  stdout, reason logged. Covered by test.
- **Builder returns null:** command does not start a session, returns
  `range-error`. Covered by test.
- **Default (no flags):** resolves the last `done` phase via the
  preSha→HEAD/genesis fallback and embeds `.mini/security/phase-<id>.md`. Verified
  manually (`phase-170.md`) and by an end-to-end `buildSecurityContext` test.

## One sharp edge to be aware of (not a regression)

`mini context security --from-phase 169 --to-phase 170` **fails** today with
"Phase 171 has no recorded pre-commit SHA". This is plain `resolveRange`
**phase-mode** semantics: to bound the *end* of phase 170 it needs the commit of
the *next* phase (171), which is the current uncommitted phase. I verified
`adversarial-project` hits the **identical** error for the same range, so this is
shared range behavior, not something this phase introduced. Workarounds:
default (no flags) reviews the last done phase via the special preSha→HEAD path,
or use an end phase that already has a committed successor
(`--from-phase 169 --to-phase 169` works).

## The big caveat the body spells out

The inline slash path runs in the **current session** with its permissions —
the scoped `SECURITY_ALLOWED_TOOLS` (read-only + `Write` confined to
`.mini/security/`) only applies to the terminal `mini security`, which spawns a
fresh Claude via `workWithClaude`. So `/mini:security` is convenience, not an
isolated/scoped audit. The command body says this explicitly and points to the
two escape hatches (terminal `mini security`, or `/clear` then re-run).

## Verification

- `npm run typecheck` — clean.
- `npm run test` — 1182 passed (87 files). Two pre-existing count/list assertions
  (`install-commands.test.ts`, `install.test.ts`) were updated for the new
  command (22 → 23 files).
- Manual: default, explicit `169-169` range, invalid mixed-flags, and the
  embedded report path all behave as expected.

Note: the `.md` slash command is **generated at install time** (it is not tracked
in git), so to actually use `/mini:security` in this project the commands must be
regenerated (`mini install-commands`, or it ships via npm postinstall to users).
Docs / `mini --help` page / `doctor` recognition for the command remain a separate
backlog item ([19]).
