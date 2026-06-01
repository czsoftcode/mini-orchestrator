---
description: mini — revert the last state change by one step
---

This is the **undo** step of the mini workflow, run directly in Claude Code. It reverts the last state change by one step. Mini remembers only **one** step back, so this is a one-shot, irreversible action — confirm it with the user before applying.

Proceed in this order:

1. **Preview.** Run in Bash `mini undo --dry-run` — it prints what would be reverted (phase/step status changes, and whether an auto-commit would be soft-reset) without changing anything. Relay that summary to the user in the chat.
2. **Confirm.** Ask the user whether to proceed (it cannot be undone again). **Wait for their answer** — do not apply anything before it.
3. **Apply.** Only after they confirm, run `mini undo --yes` — it reverts the state by one step without a TTY prompt. Relay the result. If the user declines, change nothing.

Never run a bare `mini undo` — it would block on an interactive Y/n prompt in this non-interactive Bash. Change the state in `.mini/` only via these commands, never edit `.mini/state.json` by hand.
