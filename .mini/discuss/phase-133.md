# Phase 133 — README first-phase walkthrough

## Intent
Give a brand-new user a "first 5 minutes" walkthrough of the **slash-command**
path (project priority), showing not just *which* commands to run but *what they
will see* in the Claude Code chat: the 4 questions `/mini:init` asks, what
`/mini:next` proposes, the steps from `/mini:plan`, the implementation in
`/mini:do`, and the human verification at `/mini:done`.

The distinct value vs. existing README sections: the current `## See it in action`
transcript and `### Prefer the terminal?` show the **CLI** cycle with deterministic
`[ok]` output; `## Quick start` lists the slash commands but with **no output at
all**. This phase fills the gap = the *conversational/interactive* experience of
the slash-command flow inside the chat.

## Key decisions
- **Sample output = illustrative snippets**, clearly labelled "example — your
  output will differ" (NOT a verbatim transcript). Slash-command flow runs through
  Claude's chat and is non-deterministic, so a fixed transcript would be false.
- **Placement = collapsible `<details>` block**, kept compact so it does not bloat
  the already-long README (~494 lines). Natural location: right after the Quick
  start command list (around line 80), as an expandable "walk through your first
  phase" block. No new top-level section; Quick start stays scannable.
- Primary path is the slash commands (`/mini:init` → `/mini:next` → `/mini:plan`
  → `/mini:do` → `/mini:done`), per project priority — not the CLI cycle.

## Watch out for
- **Even "example" snippets must match real behaviour** (e.g. `/mini:init` really
  asks 4 questions; `/mini:done` is the human-verification/advance step). A stale
  or false snippet destroys trust just like a stale transcript would.
- **Do not duplicate the CLI transcript** in `## See it in action` — this block
  must show the chat/conversational specifics, not repeat `mini ...` CLI output.
- **No contradiction with `## Quick start`** (same command order, same one-line
  meanings) or with `## Auto mode` / FAQ.
- **English only** (project rule).
- Keep the change small: one inserted `<details>` block, no reordering of existing
  sections.
- Markdown/`<details>` must render on GitHub (it is already used in this README,
  so follow the same pattern).
