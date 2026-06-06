---
phase: 140
verdict: done
steps:
  - title: "Create docs/files.md"
    status: done
  - title: "Create docs/faq.md"
    status: done
  - title: "Trim README FAQ to new-user concerns"
    status: done
  - title: "Drop 'Files in the project' from README"
    status: done
  - title: "Link new pages from docs index"
    status: done
  - title: "Verify links and length"
    status: done
verify:
  - title: "Read the trimmed README FAQ — are the 4 kept questions the right ones?"
    detail: "Kept: permission prompts, pause & resume, commit-after-phase (condensed), API key vs Pro/Max. Dropped to docs/faq.md: version bump/CHANGELOG/tag, memory record, undo-after-commit, 'edit a proposed phase', 'done with todo steps'. Subjective call on which belong in README."
---

# Phase 140 — report from the auto session

Moved the two reference-heavy sections out of README into `docs/`:

- **docs/files.md** — the full `.mini/` layout tree + all the state.json/phases/graph/memory prose, verbatim, with a short intro. Fixed one stale link inside it: the old `[Auto mode](#auto-mode)` README anchor now points to `non-interactive/auto.md`, and dropped the "(see above)" graph.json comment that referred to a README section no longer adjacent.
- **docs/faq.md** — all 8 original FAQ entries, including version-bump/undo/memory internals.

In README:

- FAQ trimmed to 4 new-user entries (permission prompts, pause & resume, commit-after-phase condensed, API key vs Pro/Max) ending with a one-line link to docs/faq.md. The commit entry was condensed — bump/tag detail lives in the docs version now.
- "Files in the project" section removed entirely; added a one-line pointer `([what's in there](docs/files.md))` to the intro paragraph where `.mini/` is first mentioned.
- Added a "Concepts & guides" section to docs/README.md linking both new pages (the index was command-tables only, no home for conceptual docs).

**Verification done mechanically:** all relative links resolve (docs/faq.md, docs/files.md, docs/non-interactive/auto.md, index back-links), no leftover `#auto-mode` anchor or stale `## Files in the project` heading, no triple blank lines at the removal seam (map → Auto mode now adjoin cleanly). README 396 → 352 lines (−44). Only `.md` files changed, so no typecheck/tests were relevant.

**Note for the wider campaign:** −44 lines is modest because this phase added 4 FAQ entries back inline. The bigger cuts (What gets sent to Claude, Machine-readable map, Auto-mode consolidation, the duplicate transcript, section reordering) are the later B/C phases. README is not yet at the ~150 target — by design.

**Open question for the human:** the FAQ selection (see `verify`) is the one subjective call — confirm the 4 kept questions are the right new-user set before `/mini:done`.
