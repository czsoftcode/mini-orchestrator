# Phase 145 — README: drop duplicate transcript

**Goal:** Remove the inline text-transcript <details> block from 'See it in action'; replace it with a one-line image-not-loading pointer to the Quick start walkthrough (which already shows the same flow as text), eliminating the duplicate demo while keeping a fallback.

## Steps
- [done] Replace the transcript block with a pointer
- [done] Verify links and length

## Auto-commit
- Phase 145: README: drop duplicate transcript

## Run report
---
phase: 145
verdict: done
steps:
  - title: "Replace the transcript block with a pointer"
    status: done
  - title: "Verify links and length"
    status: done
---

# Phase 145 — report from the auto session

Dropped the duplicate text transcript from "See it in action".

- The whole `<details>`…`</details>` block (the ~28-line console transcript of the init → next → plan → do → done cycle) is gone. In its place is a one-liner: *"Image not loading? The same flow, step by step as text, is in the [Quick start walkthrough](#quick-start) below."*
- The GIF, its alt text and the `<sub>` caption are untouched — only the redundant fallback transcript was removed. The image-not-loading fallback survives as a link to the Quick start walkthrough, which is the same cycle shown as text (and richer).

**Verified mechanically:** README 321 → 291 lines (−30). GIF + caption still present; the `#quick-start` anchor target (`## Quick start`) exists; no leftover `console` block or stray `<details>` from the removed transcript (the `mini:init`/`todo-api` hits that remain are the kept Quick start walkthrough, not the dropped block); no double blank lines. Only README.md changed — no typecheck/tests relevant.

This phase carried out the alternative weighed in `/mini:next` — pointing the fallback at the walkthrough rather than moving the transcript into `docs/` (a second copy would be needless maintenance). Not a deep architectural crossroads, so no ADR was recorded.

**Open question for the human:** the fallback is now a link, not an inline transcript — if the GIF fails to load, the reader has to click through to Quick start rather than seeing text immediately. Confirm that's an acceptable trade for removing the duplication.

**Campaign status:** README 396 → 291. Block C is done. Remaining: block A — remove the CI/billing HTML comment (agreed), trim the 3× "illustrative" disclaimers to one, verify the GIF actually exists/loads on main; then block D — final length pass toward ~150.
