---
description: mini — overview of the existing codebase into .mini/codebase.md (supplementary)
---

This is the **audit** step of the mini workflow, run directly in Claude Code.

Run in Bash `mini audit` — it goes through the existing code and creates/updates `.mini/codebase.md` (a codebase overview for later sessions). When done, briefly summarize the result to the user in the chat. It does not change the phase state in `.mini/state.json` in any way — it is typically run right after `/mini:init` in an existing project, optionally after `/mini:map`.
