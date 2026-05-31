---
description: mini — start a new project (questions happen in the session)
---

This is the **init** step of the mini workflow, run directly in Claude Code. You start a new mini project in the current directory. The state in `.mini/` is created by the `mini init --apply …` command — never write `.mini/state.json` or `.mini/project.md` by hand.

Proceed in this order:

1. **Ask the user** four things (short answers, in the chat):
   - **project name** (if they say nothing, leave the default = directory name),
   - **what it builds** (1-2 sentences),
   - **who it's for** (the target user),
   - **main constraints** (language/framework/deadline — may be left empty).
2. **Save the project.** Run in Bash:
   `mini init --apply --name "<name>" --what "<what>" --for-whom "<for whom>" --constraints "<constraints>"`
   (you can omit `--name` and `--constraints` when the user left them empty). If the command reports that the project already exists and the user **confirms** overwriting (the old phase history will be lost), repeat the command with `--force`. Without confirmation, stop.
3. **Offer the next steps.** From the command output you can tell whether there is already some code in the directory (brownfield):
   - **there is code** → offer the user `/mini:map` (project graph) and after it `/mini:audit` (codebase overview into `.mini/codebase.md`),
   - **empty directory** → offer `/mini:next` (propose the first phase).

Briefly relay the command output and the recommended next steps to the user in the chat.
