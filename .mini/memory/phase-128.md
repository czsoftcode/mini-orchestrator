# Phase 128 — On-demand mini:decision + thin trigger

**Goal:** Move the full ADR drafting instruction out of the done prompt into a new on-demand 'mini context decision' command (add 'decision' to CONTEXT_COMMANDS) with a matching /mini:decision slash command; insert into the do/auto prompt only a sharp, apt, concise trigger that offers running /mini:decision when the phase hits a real crossroads; slim the heavy ADR block out of buildDoneSessionPrompt. Acceptance: the trigger must stay sharp enough not to raise the rate of forgotten ADRs.

## Steps
- [done] buildDecisionSessionPrompt + mini context decision
- [done] Slim buildDoneSessionPrompt to a thin pointer
- [done] Thin pointer in the do prompt (buildAutoPhasePrompt)
- [done] Register /mini:decision in COMMAND_DEFS
- [done] Docs + README

## Auto-commit
- Phase 128: On-demand mini:decision + thin trigger

## Discussion
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

## Run report
---
phase: 128
verdict: done
steps:
  - title: "buildDecisionSessionPrompt + mini context decision"
    status: done
  - title: "Slim buildDoneSessionPrompt to a thin pointer"
    status: done
  - title: "Thin pointer in the do prompt (buildAutoPhasePrompt)"
    status: done
  - title: "Register /mini:decision in COMMAND_DEFS"
    status: done
  - title: "Docs + README"
    status: done
verify:
  - title: "Are the two thin ADR pointers (do + done) sharp enough?"
    detail: "The acceptance criterion of the phase is behavioural: the pointers must not raise the rate of forgotten ADRs. I can't verify that mechanically — it shows up only on live phases. Read the do pointer (src/prompts/autoPhase.ts, after the acceptEdits line) and the done pointer (src/prompts/sessionContext.ts, '# Decision record (ADR)' in buildDoneSessionPrompt) and judge whether they are sharp/clear enough vs. their brevity."
---

# Phase 128 — report from the auto session

All five steps done, full suite green (917 tests) and `tsc --noEmit` clean. Ran
`mini context decision` live (via tsx) — the new on-demand prompt renders for the
current phase.

## What was done
- **New `buildDecisionSessionPrompt(phase)`** in `sessionContext.ts` holds the
  full ADR drafting instruction (draft → show user → `mini decision --apply`,
  targeting the current phase). Wired as `mini context decision`: `'decision'`
  added to `CONTEXT_COMMANDS`, routed through `buildPhaseContext`.
- **`buildDoneSessionPrompt` slimmed**: the ~37-line ADR block replaced by a
  ~1-line conditional pointer to `/mini:decision`.
- **Thin pointer in `buildAutoPhasePrompt`** (`do`/`auto`): on a real crossroads,
  at the end tell the user to run `/mini:decision` before `/mini:done` — Claude
  does not write the ADR itself.
- **`/mini:decision` registered** in `COMMAND_DEFS` (default thin body → runs
  `mini context decision`).
- **Docs**: new `docs/interactive/decision.md`; `docs/non-interactive/decision.md`
  and `docs/README.md` updated (they used to say the ADR lives "within
  /mini:done"); `/mini:decision` added to the README slash-command list.

## Token reality (the honest number)
The `measure-tokens` snapshot moved as expected:
- **done** template: 976 → **702** tokens (−274 per phase).
- **do**/**auto** template: +~72 tokens (the cost of the fresh-context pointer,
  paid every phase because the pointer sits in the shared prompt).

So the **net** per-phase saving is ~200 tokens, not the ~250 the todo item
guessed — the second pointer eats into it. This matches the trade-off recorded in
the discussion notes; the freshness of detecting a decision during `do` is the
reason the second pointer is there.

## Design decision worth recording
This phase itself hit a real crossroads (full instruction → on-demand command,
pointer in BOTH do and done, "only notify — never auto-write", auto-mode ADRs
deliberately don't fire). Per the new flow, before `/mini:done` consider running
`/mini:decision` to capture the *why* — I'm flagging it rather than writing it,
as designed.

## Watch out for
- The two pointers are a matched pair — if one is later edited, keep the other in
  sync, or they drift on what counts as "a real decision".
- `mini context decision` reuses `buildPhaseContext`, so between `done` and `next`
  (no current phase) it errors with the standard "No current phase" hint. That is
  the intended window (the ADR must be written before `done`).
