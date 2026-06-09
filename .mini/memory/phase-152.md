# Phase 152 — Prompt hardening for Fable 5

**Goal:** Skill bodies in src/install/commands.ts and session prompts in src/prompts/sessionContext.ts explicitly require printing command output verbatim in the final message (no summarizing) and ending the turn after asking the user (no --apply in the same turn); covered by updated snapshot tests.

## Steps
- [done] Shared hardened hint constants
- [done] Harden session prompts in sessionContext.ts
- [done] Harden skill bodies in commands.ts
- [done] Update snapshot tests
- [done] Green plus reinstall

## Auto-commit
- Phase 152: Prompt hardening for Fable 5

## Run report
---
phase: 152
verdict: done
steps:
  - title: "Shared hardened hint constants"
    status: done
  - title: "Harden session prompts in sessionContext.ts"
    status: done
  - title: "Harden skill bodies in commands.ts"
    status: done
  - title: "Update snapshot tests"
    status: done
  - title: "Green plus reinstall"
    status: done
verify:
  - title: "Fable 5 actually prints overviews and stops on questions in a fresh session"
    detail: "Mechanically verified: hardened wording is present in the generated .md files and session prompts, tests cover it. What only a human can judge is the behavioral effect — in a new session run e.g. /mini:status (full table printed verbatim?) and /mini:next without an idea (does it ask and end the turn instead of saving --apply immediately?)."
---

# Phase 152 — report from the auto session

## What was done

- **New module `src/prompts/sessionHints.ts`** with two shared constants:
  - `VERBATIM_OUTPUT_HINT` — "print the complete command output verbatim in your final message … the user does not read the Bash tool result; what you do not print, they never see."
  - `ASK_AND_STOP_HINT` — "ask, then END YOUR TURN … never run a state-changing command (`mini ... --apply`) in the same turn as the question."
- **Session prompts (`sessionContext.ts`)**: `next` (Ask-first block + approval gate), `plan` (show steps → approve), `project` (interview batches + final draft approval), `decision` (ADR draft approval), `done` (both verify branches gate `mini done --apply`), `verify` (one-at-a-time interactive review) — all now embed `ASK_AND_STOP_HINT` and gate `--apply` on a *later* user message.
- **Skill bodies (`install/commands.ts`)**: `status`, `doctor`, `changelog`, `map`, `model`, `todo`, `init`, `import-gsd`, `undo`, `upgrade` now require printing the command output verbatim (shared hint; `audit` got a short inline variant). Confirmation steps (`init` overwrite, `undo`, `upgrade`, `model` scope question, `import-gsd` overwrite) embed `ASK_AND_STOP_HINT`. `auto` was deliberately left alone — it is autonomous mode where brevity is wanted.
- **Tests**: new `src/install/commands.test.ts` (verbatim + ask hints per command, plus a guard that no unexpanded `${…}` placeholder leaks into the rendered .md); new describe block in `sessionContext.test.ts` asserting the hint in all six session prompts; token-report snapshots in `src/tokens/__snapshots__/measure.test.ts.snap` regenerated (prompt sizes grew, ranking order of next/plan flipped — wording-only change).
- **Green + reinstall**: `npm test` (979 tests, 75 files) and `npm run build` pass; `npm run install-local` + `mini install-commands` refreshed `~/.claude/commands/mini/` (11 files changed).

## Notes for the human

- The trade-off discussed up front stands: older/better-behaved models will now verbatim-print even long outputs and add an extra turn for approvals. That is the intended price for deterministic behavior on Fable 5 / Opus 4.7+.
- No prompt-level guarantee is absolute — harness instructions can still override wording. If Fable 5 keeps misbehaving on a specific command, that command's body is the place to escalate next.
