# Phase 138 — README top-level Documentation link

**Goal:** Add a short Documentation pointer near the README intro/Quick start that links to docs/README.md, so the full two-variant command reference is discoverable from the top of the README.

## Steps
- [done] Add Documentation pointer near intro
- [done] Keep the Commands-section callout non-duplicate
- [done] Verify links and headings

## Auto-commit
- Phase 138: README top-level Documentation link

## Run report
---
phase: 138
verdict: done
steps:
  - title: "Add Documentation pointer near intro"
    status: done
  - title: "Keep the Commands-section callout non-duplicate"
    status: done
  - title: "Verify links and headings"
    status: done
---

# Phase 138 — report from the auto session

## What was done
- Added a short **Documentation:** pointer at the top of the README (right after
  the **Website:** line, line 21), linking to [`docs/`](docs/README.md) as the
  central command reference. It now sits above the fold, before `## See it in
  action` and `## Quick start`.
- The docs index was **already** linked once (the 📖 callout in `## Commands`,
  now line 256). To avoid two identical pointers, the roles were split:
  - **Top (line 21):** discoverability — carries the full descriptor ("every
    command in both the interactive `/mini:*` and terminal `mini` variants, with
    all flags").
  - **Commands section (line 256):** reworded to "Browse the per-command pages
    … in `docs/`" — a contextual "go here for the detail" pointer, no longer a
    verbatim copy of the top line.

## Verification (done mechanically)
- `docs/README.md` exists — link target is valid.
- Exactly two references to `docs/README.md` remain (lines 21 and 256), each
  with distinct wording.
- No duplicate README headings (would break anchor links) — `uniq -d` over the
  `#`/`##`/`###` headings returned nothing.

## Notes
Trivial doc-only phase, no code touched. No real crossroads/decision to record.
Relative links can't be clicked-through here, but the target file is confirmed
present, so nothing needs a human eye.
