# Phase 128 — On-demand mini:decision + thin trigger

## Intent
Stop paying the full ADR instruction (~360 tokens) in the `done` prompt on
**every** phase, when ~95% of phases write no ADR. Move the full drafting
instruction into a new on-demand `/mini:decision` slash command (`mini context
decision`, added to `CONTEXT_COMMANDS`), loaded only when the human invokes it.
Leave only a thin, sharp pointer in the regular cycle. Acceptance criterion is
behavioural, not token count: the pointer must stay sharp enough that ADRs are
not forgotten more often than today.

## Key decisions
- **Full instruction lives ONLY in `/mini:decision`.** It is self-contained:
  draft a lean ADR (`# title` / `## Decision` / `## Why`) → show it to the user
  for approval → write via `mini decision --apply` (which already targets the
  current phase and rejects done/skipped). This is the existing block (today
  lines ~241-277 of `sessionContext.ts`) lifted into a new
  `buildDecisionSessionPrompt(phase)`.
- **Thin pointer in BOTH `do` and `done`** (user choice). `do`
  (`buildAutoPhasePrompt`) detects the crossroads while the rationale is fresh;
  `done` (`buildDoneSessionPrompt`) is the last gate before the phase commit, so
  it reminds again. Both are ~2 lines, conditional ("if this phase made a real
  decision …").
- **The pointer only SUGGESTS — Claude does NOT auto-write the ADR** (user
  choice). It tells the user in chat to run `/mini:decision` (before
  `/mini:done`). Approval stays with the human-invoked command. Claude inside a
  running `do`/`done` session cannot execute a slash command itself anyway.
- **Auto mode: ADR simply does not fire.** `auto` has no human to approve, so a
  "tell the user to run /mini:decision" pointer is a no-op there. Accepted
  trade-off — better than silently inventing ADRs under `--yolo`. No change to
  the `auto` cycle body needed (it loads the do/done prompts as-is).

## Watch out for
- **Commit timing unchanged.** `mini decision --apply` writes to the *current*
  phase and must run before `mini done --apply` (it rejects done/skipped). The
  `done` pointer must say "before applying / before /mini:done". The window for
  `/mini:decision` is between `do` and `done`.
- **Test surface (all need updating):**
  - `context.test.ts` asserts the exact `CONTEXT_COMMANDS` array → add
    `'decision'`.
  - `buildDoneSessionPrompt` snapshot → big block removed, replaced by the thin
    pointer.
  - `autoPhase` / `do` prompt snapshot (if any) → pointer added.
  - `install-commands` test → new `COMMAND_DEFS` entry for `decision`.
  - Add a test for `buildDecisionSessionPrompt` / `mini context decision`.
- **Net token saving is smaller than "~250/phase" if the pointer is fat.** Keep
  both pointers ultra-short; the sharpness is the acceptance criterion, the
  token count is secondary.
- **Two reminders (do + done) can nag.** Phrase `done`'s as "if you haven't
  already recorded it" so a phase that already ran `/mini:decision` isn't told
  twice.
- **`COMMAND_DEFS` entry uses the default thin body** (just runs `mini context
  decision` and follows the printed prompt) — like next/discuss/plan. Existing
  installs only get the new `decision.md` on the next install/upgrade
  (postinstall), not retroactively.
- **`mini context decision` reuses `buildPhaseContext`** (requires a current
  phase); between `done` and `next` there is no current phase → it errors with
  the standard "No current phase" hint. That is acceptable — the ADR window is
  before `done`.
- **Docs:** add `docs/interactive/decision.md` (+ non-interactive if that split
  is kept) and mention `/mini:decision` in the README slash-command list.
