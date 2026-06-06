# Phase 146 — README: A-block cleanups

**Goal:** Delete the CI/billing HTML comment (lines 7-9); reduce the 'illustrative' disclaimer to a single occurrence (keep the walkthrough one, trim the GIF caption to drop the illustrative clause while keeping the 'real [ok] output' credibility note). GIF existence already confirmed (481 KB, tracked in git) so no change needed there.

## Steps
- [done] Delete the CI/billing HTML comment
- [done] Reduce 'illustrative' to one disclaimer
- [done] Verify

## Auto-commit
- Phase 146: README: A-block cleanups

## Run report
---
phase: 146
verdict: done
steps:
  - title: "Delete the CI/billing HTML comment"
    status: done
  - title: "Reduce 'illustrative' to one disclaimer"
    status: done
  - title: "Verify"
    status: done
---

# Phase 146 — report from the auto session

Block A cleanups done.

- **CI/billing HTML comment removed.** The `<!-- … -->` block that hid the CI badge and stated a "GitHub account billing issue" is gone from the public source. The npm/node/license badges are untouched. (Re-enabling CI is a separate, out-of-scope task, as agreed.)
- **"illustrative" disclaimer reduced to one.** The GIF caption's "Claude's replies are illustrative;" clause was dropped, keeping the credibility note "The `[ok]` lines are real mini output." The single remaining disclaimer is in the Quick start walkthrough ("The snippets are illustrative — your wording and phases will differ."), where wording-sets-expectations matters most. (Note: it was already only 2× after phase 145 removed the transcript, not the 3× the original feedback cited.)
- **GIF verified, no change needed.** `demo/cycle.gif` exists, is tracked in git, and is 481 KB — a reasonable size that will load; not broken or oversized.

**Verified mechanically:** README 291 → 287 lines (−4). Exactly one "illustrative" occurrence remains; no `billing`/`ci.yml`/`CI badge` strings left; the three shields.io badges are intact and the header block is well-formed; the GIF caption keeps "are real mini output"; no double blank lines. Only README.md changed — no typecheck/tests relevant.

No real rejected alternative, so no ADR.

**Campaign status:** README 396 → 287. Blocks B, C and A from the round-2 feedback are now done. What remains is block D — the final length pass toward the ~120–150 target. Reaching it needs aggressive trimming of the *prose itself* (the Quick start walkthrough ≈70 lines and Installation ≈60 lines dominate now), which is onboarding/sales content, not reference mechanics — a judgement call to make with the user rather than a mechanical move.
