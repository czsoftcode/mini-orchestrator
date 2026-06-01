---
description: mini — view or set the Claude model for the project
argument-hint: [show | reset | <scope> <model>]
---

This is the **model** step of the mini workflow, run directly in Claude Code. It views and sets the Claude model used for the project's mini steps. The model is stored in `.mini/state.json` — change it only via the `mini model` commands below, never by hand.

The user ran the command with arguments: `$ARGUMENTS`. Use only the **non-interactive** forms — a bare `mini model` or `mini model <scope>` without a value would block on an interactive picker in this Bash, so **never run those**:

- **Show the current setup:** `mini model show`.
- **Set a scope:** `mini model <scope> <model>`, where `<scope>` is one of `default | next | plan | do | importGsd | audit | memory` and `<model>` is a preset (`opus` | `sonnet` | `haiku`) or a full model ID (e.g. `claude-sonnet-4-6`). `mini model <model>` with the scope omitted sets the default.
- **Clear a scope override:** `mini model <scope> default` (back to inherited).
- **Clear everything:** `mini model reset`.

Proceed:

1. If `$ARGUMENTS` already form a complete non-interactive command (e.g. `do opus`, `show`, `reset`, `sonnet`), run `mini model $ARGUMENTS` and relay the output.
2. If they are empty, or name only a scope without a model, **do not** run the interactive form — first run `mini model show` to display the current state, ask the user in the chat which scope and which model they want, and only then run `mini model <scope> <model>`.

Relay the command output to the user in the chat.
