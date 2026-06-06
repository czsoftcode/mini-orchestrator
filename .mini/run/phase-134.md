---
phase: 134
verdict: done
steps:
  - title: "Audit links & must-keep facts"
    status: done
  - title: "Draft concise replacement section"
    status: done
  - title: "Apply edit to README"
    status: done
  - title: "Fix dangling cross-references"
    status: done
  - title: "Verify result"
    status: done
verify:
  - title: "GitHub render of the new ## Commands section"
    detail: "Mechanically validated: all internal anchors resolve, all docs/ links point to existing files, English-only, line count 563 → 506. The actual rendered look on github.com (the 📖 callout, flow into ### Autonomous) is a visual thing I can't confirm without a browser."
---

# Phase 134 — report from the auto session

## What was done

Replaced the two inline command-catalogue sections with one concise `## Commands`
block:

- **Removed** the full `## Commands` table (24 rows) and the entire
  `## mini commands directly in Claude Code` section (intro + `mini install-commands`
  snippet + the 18-line `/mini:*` slash list + the TTY-counterpart note).
- **New `## Commands`** is three short paragraphs: (1) the two-variant model
  (interactive `/mini:*` vs. terminal `mini *`, with a link back to Quick start),
  (2) a prominent **📖 pointer to [`docs/`](docs/README.md)** as the single full
  reference, (3) the thin "how it works" note (state ops in tested TS,
  `install-commands` idempotent).
- **Kept** the `### Autonomous /mini:auto` prose verbatim — it is conceptual, not a
  command catalogue, and trimming auto is a separate backlog item. It is now
  re-parented under the new `## Commands`.
- **Absorbed and dropped** the standalone "How it works" paragraph (its content is
  now in the new overview, so leaving it would have re-introduced duplication —
  this is the one deliberate deviation from the step wording, which said "keep" it).

## Result / verification (mechanical)

- README **563 → 506 lines** (−57).
- All internal anchor links resolve (`#auto-mode`, `#installation`, `#quick-start`);
  the orphaned outbound refs that lived inside removed rows
  (`#status-line`, `#machine-readable-project-map-graph`, `#autonomous-miniauto`)
  are gone with the table — nothing dangles. No external link pointed *into* the
  removed sections, so nothing broke.
- All `docs/` relative links in README point to existing files, including the new
  `docs/README.md`.
- No contradiction with Quick start: same `init → next → plan → do → done` loop
  order and meaning. English only. No TOC to update (README has none).

## Notes / open questions

- The command **catalogue now lives only in `docs/README.md`**. That is the goal,
  but it means README readers must click through for the per-command flag detail
  (e.g. `mini done --bump`, `mini completion`). Acceptable trade-off given the
  docs index is complete and two-variant.
- Backlog items 29–32 (merge Models+Status line, condense graph sections, trim
  Auto mode + Import-GSD, top-level docs link near the intro) remain — this phase
  only handled the largest duplication (the command tables).
- No real crossroads worth an ADR here.
