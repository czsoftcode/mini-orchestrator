# Phase 164 — adversarial-project: interactive command

**Goal:** Add an interactive 'mini adversarial-project --from-phase/--to-phase' (and --from/--to) command — a fresh workWithClaude session whose first message is built by buildProjectAdversarialContext, run with scoped read-only tools (Read/Grep/Glob/LS, git diff/log/show, mini findings add; NO Edit), wired into cli.ts, mirroring adversarial.ts. Cleanly exits when buildProjectAdversarialContext returns null (range error). Does NOT include the slash-path 'mini context adversarial-project' subcommand (5/7) or the slash command (6/7).

## Steps
- [done] adversarialProject command (interactive session)
- [done] Scoped read-only tool set (no Edit)
- [done] Wire mini adversarial-project into cli.ts
- [done] Unit tests for adversarialProject

## Auto-commit
- Phase 164: adversarial-project: interactive command

## Run report
---
phase: 164
verdict: done
steps:
  - title: "adversarialProject command (interactive session)"
    status: done
  - title: "Scoped read-only tool set (no Edit)"
    status: done
  - title: "Wire mini adversarial-project into cli.ts"
    status: done
  - title: "Unit tests for adversarialProject"
    status: done
---

# Phase 164 — report from the auto session

Added the interactive `mini adversarial-project` command (4/7 of the
adversarial-project track), mirroring `adversarial.ts`.

## What was done

- **`src/commands/adversarialProject.ts`** — `adversarialProject(input: RangeInput)`:
  checks `exists(cwd)`; builds the first message via
  `buildProjectAdversarialContext(cwd, input)`; on `null` (range error, already
  logged by the builder) returns `{ ok:false, reason:'range-error' }` and never
  starts Claude; otherwise prints the prompt, confirms, runs `workWithClaude`
  with the scoped tool set, and handles cancel / claude-error / non-zero exit.
- **Scoped tool set** — kept as its own constant (not shared with `adversarial.ts`)
  so each command's pinning test fails independently if its set drifts: Read,
  Grep, Glob, LS, `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git show:*)`,
  `Bash(mini findings add:*)`. No `Edit` — the load-bearing report-only guarantee.
- **`cli.ts`** — new `adversarial-project` command with `--from-phase`/`--to-phase`
  (parsed by a new `parsePhaseNumber` helper using `InvalidArgumentError`, the
  same idiom as `parseMaxTurns`) and `--from`/`--to` string refs. Assembles a
  `RangeInput` and dispatches.
- **`adversarialProject.test.ts`** — 6 tests, mocking `workWithClaude`, `ask`, and
  `buildProjectAdversarialContext`. The builder is mocked on purpose: range
  resolution is already covered by `range.test.ts` and
  `adversarialProjectContext.test.ts`, so this file isolates the command's own
  control flow (null → no session; string → session; cancel; claude-error;
  non-zero exit still ok; no-project).

## Verification (all mechanical, done here)

- `npx vitest run` — 83 files, 1136 tests pass (6 new).
- `npm run typecheck` — clean.
- Built `dist/` and smoke-tested the real CLI:
  - `mini adversarial-project --help` lists all four flags.
  - `--from-phase abc` → `error: ... Must be a phase number ...`, exit 1.
  - no flags (in a real project) → "No range given." and exits 0, **no** Claude
    spawn, no hang.

## Notes / what to watch

- Range semantics (mixing phase+ref flags, empty range, missing `preSha`) are
  deliberately left to `resolveRange` — not re-tested at the command level to
  avoid duplicating `range.test.ts`. If `resolveRange` behaviour changes, this
  command silently inherits it; that is the intended trade-off.
- The scoped-tools guarantee leans on Claude Code honouring the `allowedTools`
  set (dropping `Edit`). Same caveat as `adversarial.ts`; not independently
  re-verified here.
- 5/7 (`mini context adversarial-project` for the slash path) and 6/7 (the
  `/mini:adversarial-project` slash command) are out of scope and remain in the
  backlog.
