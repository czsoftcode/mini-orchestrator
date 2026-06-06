# Phase 135 — README slim-down: Models + Status line

**Goal:** Replace the long inline ## Models and ## Status line sections with two short blurbs that link to the docs pages (model.md, install-statusline.md), moving the detailed flags and status-line cache/refresh mechanics into docs so the README stops duplicating them.

## Steps
- [done] Audit must-keep facts vs. docs
- [done] Enrich install-statusline.md docs
- [done] Slim ## Models to a blurb
- [done] Slim ## Status line to a blurb
- [done] Fix cross-refs, relocate token-cost line, verify

## Auto-commit
- Phase 135: README slim-down: Models + Status line

## Run report
---
phase: 135
verdict: done
steps:
  - title: "Audit must-keep facts vs. docs"
    status: done
  - title: "Enrich install-statusline.md docs"
    status: done
  - title: "Slim ## Models to a blurb"
    status: done
  - title: "Slim ## Status line to a blurb"
    status: done
  - title: "Fix cross-refs, relocate token-cost line, verify"
    status: done
verify:
  - title: "README reads well after the slim-down"
    detail: "Mechanically verified: README 506 → 458 lines, all docs links resolve, no dangling refs. The subjective flow of the two new blurbs (Models, Status line) is worth a human read."
---

# Phase 135 — report from the auto session

## What was done

Replaced the two long inline sections with short blurbs that link out to docs,
moving the detail to where it belongs rather than deleting it.

- **`## Models`** (was ~20 lines) → ~7 lines: one 3-command example, the
  sonnet/opus saving combo, the cheaper-model economics note, and a link to
  [`mini model`](docs/non-interactive/model.md) for the full flags/scopes. The
  full flag table and `mini model reset/plan/default` examples already lived in
  `docs/.../model.md`, so nothing was lost here.
- **`## Status line`** (was ~50 lines of cache/refresh + postinstall mechanics)
  → ~5 lines: one gauge example, the opt-in note, and a link to
  [`mini install-statusline`](docs/non-interactive/install-statusline.md).
- **`docs/non-interactive/install-statusline.md`** — enriched **before** cutting
  from the README, since the docs did **not** previously cover this. Added two
  sections: "What the status line shows" (gauge/segment anatomy + the
  `↑ <version>` hint) and "How the version check refreshes" (temp-dir cache,
  detached background refresh, per-session check + 5h cooldown, retry cooldown,
  renderer note). This is the key step that kept the knowledge instead of losing it.
- Re-homed the orphaned token-cost example `(20.4k tokens · …)` from the old
  Status line section to the end of `## What gets sent to Claude`, where the
  cost/token context actually fits.

## Verification

- README: **506 → 458 lines** (−48).
- All four `docs/*.md` links in the README resolve to existing files.
- No leftover anchors (`#models`, `#status-line`) or dangling references to the
  removed `statusLine` JSON block / `mini model` table. The two remaining
  `statusLine` mentions (Installation section, new blurb) are intentional.

## Trade-off

Net README reduction is −48 lines, smaller than a pure delete would give,
because step 2 grew `install-statusline.md` by ~40 lines. That's deliberate: the
cache/refresh mechanics are real, useful detail — they move to docs, they don't
vanish.

## Notes

No real architectural crossroads here, so no ADR needed. Next: `/mini:done`.
