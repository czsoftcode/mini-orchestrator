---
description: mini — autonomous mode: completes several phases in a row
argument-hint: [--max-phases N] [--yolo] [--verify] [--discuss]
---

This is the **auto** step of the mini workflow, run directly in Claude Code. You are in **autonomous mode**: in a loop you complete whole phases yourself (next → discuss(conditionally) → plan → do → verify(conditionally) → done) and after finishing one phase you smoothly continue with the next, until you hit one of the run boundaries (see "End of run"). Change the state in `.mini/` only with `mini ... --apply` commands, never edit `.mini/state.json` by hand.

## Run arguments
The user ran the command with arguments: `$ARGUMENTS`. Parse from them (leniently, order doesn't matter):
- **`--max-phases N`** — how many phases at most to complete in a row. When missing (or unreadable), use the **default 1**.
- **`--yolo`** — fully unattended mode (see "Confirming commands"). When missing, run in normal mode.
- **`--verify`** — forces the **verify** step (in-depth UI/UX review by a human) in **every** phase of the run, even if it doesn't seem UI/UX to you. Without it you run verify only conditionally (see step 5 of the cycle).
- **`--discuss`** — forces the **discuss** step in **every** phase of the run, even if it seems straightforward to you. Without it you run discuss only conditionally (see step 2 of the cycle).

At the start, **once** briefly announce to the user how many phases you'll run and which of the `--yolo` / `--verify` / `--discuss` switches are on.

## The cycle of one phase
For each phase go through these steps in sequence (start the next one only after finishing the previous):

1. **next (stop and ask).** If there is currently **no** phase in progress (after a previous `done`, or at the start when the last phase is finished), propose the next one. Run `mini context next` and follow the prompt, but **first stop and take an idea/input from the user** for the next phase (autonomous mode does not invent phases blindly). When `mini context next` / your proposal concludes that the **project is finished** (TITLE: -), end the cycle cleanly (see "End of run"). If a phase is already in progress (`proposed`/`planned`/`doing`), skip this step.
2. **discuss (conditionally / forced, stop and ask).** Run `mini context discuss` when the phase is hard to decide on (an ambiguous goal, multiple directions, something to clarify) **and** a discussion hasn't happened for it yet, **or** always when the run got `--discuss`; then interactively gather input from the user and save the notes. For a straightforward phase without `--discuss`, **skip** the step.
3. **plan.** Run `mini context plan` and break the phase into steps; save via `mini plan --apply`. If the phase already has steps, skip.
4. **do (quietly).** Run `mini do --apply` and then `mini context do`; implement the phase per the instructions. **Don't print edit listings** — don't retell every file change into the chat, just briefly report progress step by step. After each finished step, mark it: `mini do --apply --step-done "<exact name>"`. At the end, write the report into `.mini/run/phase-{id}.md`.
5. **verify (conditionally, stop and let it be reviewed).** Run this step when the phase is **UI/UX in nature** — it has a visible output only a human can judge (appearance, CLI/screen, UX flow, clarity); judge that from the phase goal, the steps and the report. **Or** run it always when the run got `--verify`. For a purely internal phase (refactor, parser, build, tests with no visible output) and without `--verify`, **skip** verify. When it runs: leave the report from `do` written, run `mini context verify` and take the human through an in-depth UI/UX review per the prompt (ask one at a time). The findings are written into the report (the prompt guides you), so they reach the memory through the report too. **If problems are found, don't close the phase** — go back to `do`, fix them within this phase, update the report and only then continue to `done`. Verify is human-driven — **auto does not bypass it**.
6. **done.** Run `mini context done` and move the state; the final save is `mini done --apply`. For **items for manual verification (verify)**, **stop and let the user verify** — auto does not bypass verify.

Between steps and between phases, briefly report to the user where you got (without flooding the chat).

## Confirming commands
In **normal** mode you leave confirming bash commands to the user (it's governed by the session's permission mode, or an allowlist in `.claude/settings.json`). In **`--yolo`** mode you shouldn't burden the user with prompts — but that only works when the session **runs in acceptEdits** (start Claude Code with `--permission-mode acceptEdits`, or switch it within the session). The slash command itself does not turn off confirmation. When you get `--yolo` but the session isn't in acceptEdits, point it out once and continue normally.

## Stop hooks (cooperative stopping)
At these **checkpoints** check whether you should finish cleanly (when the file `.mini/STOP` exists, finish the step in progress, write the report and finish with the message "Stopped on request"; otherwise continue). The signal is created by the user from another terminal with the `mini stop` command (cleared by `mini stop --clear`) — you only read the file at these points:
- **between cycle steps** — before each further `mini context …` call,
- **after each finished step in `do`** — right after `mini do --apply --step-done "…"`.
(The whole-phase boundary is automatically included in that.) Stopping is necessarily cooperative — you wouldn't read a message written into this session during work anyway; a hard interruption mid-step is on Esc/Ctrl+C.

## End of run
End the cycle (and briefly summarize what happened) when any of the boundaries occurs:
- you completed **`--max-phases`** phases,
- `next` concluded that the **project is finished**,
- you hit a **blocker** you can't get around yourself — stop and hand control to the user (don't force the rest),
- a **stop hook** fired.
