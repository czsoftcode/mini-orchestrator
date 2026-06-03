# Phase 119 — Critical-feedback rule in CLAUDE.md

**Goal:** Add a short "Working style" section to the project CLAUDE.md instructing Claude not to blindly agree and to give honest, including critical, feedback.

## Steps
- [done] Add "Working style" section to CLAUDE.md
- [done] Place it without clashing with language rules
- [done] Wrap up and checks

## Auto-commit
- Phase 119: Critical-feedback rule in CLAUDE.md

## Run report
---
phase: 119
verdict: done
steps:
  - title: "Add \"Working style\" section to CLAUDE.md"
    status: done
  - title: "Place it without clashing with language rules"
    status: done
  - title: "Wrap up and checks"
    status: done
---

# Phase 119 — report from the auto session

Added a new `## Working style` section to the project `CLAUDE.md`, placed after
the "Project language" section so the two concerns stay separate: language rules
govern program text, the new section governs how Claude should collaborate.

The section contains two bullet points in English, matching the request:
- Don't blindly agree with everything the user proposes — flag flawed/risky
  ideas and better alternatives.
- Give honest, including critical, feedback — point out problems, trade-offs and
  mistakes directly.

Wording follows the file's existing tone (bold lead-in + short explanation).
Documentation-only change; no code, build or tests affected.
