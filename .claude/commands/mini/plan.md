---
description: mini — break the current phase down into concrete steps
---

This is the **plan** step of the mini workflow, run directly in Claude Code.

Run in Bash `mini context plan` and follow the printed instructions **exactly**. The prompt contains the current project context as well as how to save the state at the end (via `mini ... --apply`). Change the state in `.mini/` only with those commands — never edit `.mini/state.json` by hand.
