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
