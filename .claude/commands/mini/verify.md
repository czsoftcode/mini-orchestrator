---
description: mini — in-depth UI/UX review of the phase by a human
---

This is the **verify** step of the mini workflow, run directly in Claude Code.

Run in Bash `mini context verify` and follow the printed instructions **exactly**. The prompt contains the current project context as well as how to save the state at the end (via `mini ... --apply`). Change the state in `.mini/` only with those commands — never edit `.mini/state.json` by hand.
