# Phase 133 — README first-phase walkthrough

**Goal:** Add a 'Your first phase' walkthrough section to README.md showing the first-5-minutes path after npm install — the first slash command to run (/mini:init then /mini:next, /mini:plan, /mini:do, /mini:done), what the user sees, and a short sample of the actual output, so a new user knows exactly how to start. Use the slash-command flow as the primary path (project priority), not the CLI cycle.

## Steps
- [done] Verify real slash-command behaviour
- [done] Draft the walkthrough <details> block
- [done] Insert after Quick start command list
- [done] Check duplication, contradictions, render

## Auto-commit
- Phase 133: README first-phase walkthrough

## Discussion
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

## Run report
---
phase: 133
verdict: done
steps:
  - title: "Verify real slash-command behaviour"
    status: done
  - title: "Draft the walkthrough <details> block"
    status: done
  - title: "Insert after Quick start command list"
    status: done
  - title: "Check duplication, contradictions, render"
    status: done
verify:
  - title: "The <details> walkthrough renders correctly on GitHub"
    detail: "Tag balance (5/5 <details>/</details>) and code-fence parity (54, even) verified mechanically; the actual collapsed/expanded rendering and the 'You:/Claude:' code blocks can only be confirmed by eye on the GitHub-rendered README. The <details> pattern is already used 4× in this README, so risk is low."
---

# Phase 133 — report from the auto session

Added a single collapsible `<details>` block titled "Walk through your first phase
(what you'll actually see in the chat)" right after the Quick start command list
(between "That's the whole loop…" and "### Prefer the terminal?"). No new top-level
section, no reordering.

## What it does
Shows the first-5-minutes **slash-command** path as a short *conversation* for each
step (`/mini:init` → `/mini:next` → `/mini:plan` → `/mini:do` → `/mini:done`),
using `You:`/`Claude:` snippets — i.e. the interactive/chat experience, which the
existing sections did not cover. The whole block is explicitly labelled
"illustrative — your wording and phases will differ" so the non-deterministic chat
output is never presented as a fixed transcript.

## Accuracy checks (against source of truth)
- Behaviour confirmed against `src/install/commands.ts` (the slash-command bodies):
  `/mini:init` really asks **4 questions** in chat; `/mini:done` is the
  human-verify-then-advance step; command order/meanings match `## Quick start`.
- Commit claim cross-checked with the FAQ ("Commit and push after a phase?"):
  `done` auto-commits as `Phase {id}: {title}` and **never** pushes automatically —
  the snippet shows the commit only, no push. No contradiction with `## Auto mode`
  or FAQ.
- No duplication of the CLI transcript in `## See it in action` (that one is
  `mini ...` CLI + `[ok]` output; this block is `/mini:*` + conversational). Reusing
  the same todo-api / Health-endpoint example is intentional, for consistency.
- English only (project rule).

## Mechanical verification done
- `<details>`/`</details>` balanced (5/5), code-fence count even (54) → markdown
  structure is sound.

## For the human
Just give the rendered README a quick look on GitHub (or a markdown preview) to
confirm the collapsible block expands and the snippets read well — see the `verify`
item above. Nothing else outstanding.
