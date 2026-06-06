---
phase: 132
verdict: done
steps:
  - title: "Insert section after Installation"
    status: done
  - title: "Fact-check claims vs Claude Code and README"
    status: done
  - title: "Verify markdown and structure"
    status: done
verify:
  - title: "Render the section on GitHub and read it for tone"
    detail: "Does the comparison table render correctly and read as honest (a difference in approach, not a hit piece on native plan mode)? Mechanical checks (one heading, 5+2 table rows, anchors intact) are done."
---

# Phase 132 — report from the auto session

## What was done
Added a new `## How is this different from Claude Code's plan mode?` section to
`README.md`, placed between `## Installation` and `## Commands` (per the
discussion).

- **Honest opening:** acknowledges Claude Code already has plan mode AND an
  in-session todo list, and that it may be all some users need.
- **Framing = scope + persistence:** native plan mode and its todos are in-memory
  and ephemeral (gone when the session ends); mini is the persistent, multi-session
  layer on disk. No false "native has nothing" claims.
- **5-row table** (Scope, Persistence, Memory, Git, Autonomy) — the draft's
  overlapping Persistence / Progress tracking / Across sessions rows merged into
  one honest Persistence row.
- **Closing guidance:** "use native plan mode for a one-off / use mini when a
  project spans many sessions".

## Verified mechanically
- Exactly one occurrence of the new heading.
- Table is well-formed: header + separator + 5 data rows (7 `|`-lines), 3 columns
  throughout.
- All in-page anchors still resolve (`#auto-mode`, `#autonomous-miniauto`,
  `#installation`, `#machine-readable-project-map-graph`, `#status-line`); the new
  section adds no internal links.
- Cross-checked the two factual claims against the existing body: "optional
  auto-commit per phase" matches the `mini done` row / FAQ (auto-commit on done,
  default `--bump none`); "`/mini:auto` chains phases with human checkpoints"
  matches the `### Autonomous /mini:auto` section.
- English-only.

## Notes / open questions
- Section placement and wording follow the discussion notes exactly; small,
  additive change, no reordering of existing sections.
- No architectural crossroads — no `/mini:decision` needed.
