# Phase 117 — README Backers section

**Goal:** Add a Backers section to the README that thanks sponsors, with an auto-generation placeholder (comment markers for a tool like sponsorkit) and a call-to-action linking to GitHub Sponsors, placed next to the Support section.

## Steps
- [done] Add Backers section to README
- [done] Wrap up and checks

## Auto-commit
- Phase 117: README Backers section

## Run report
---
phase: 117
verdict: done
steps:
  - title: "Add Backers section to README"
    status: done
  - title: "Wrap up and checks"
    status: done
---

# Phase 117 — report from the auto session

## What was built
- **README "Backers" section** between *Support* and *License*: a thank-you line,
  a "be the first to back" call-to-action linking to
  `github.com/sponsors/czsoftcode`, and a sponsorkit-style placeholder
  `<!-- sponsors --><!-- sponsors -->` so a tool (or GitHub Action) can later
  auto-fill sponsor avatars between the markers.

## Verified mechanically
- `npm run typecheck` — clean.
- `npm test` — 68 files, **854 tests pass** (docs-only change, no regression).

## Note for the human
The section is intentionally empty for now (no sponsors yet) — it invites the
first backer. When sponsors arrive you can either fill the list by hand or wire up
[sponsorkit](https://github.com/antfu/sponsorkit) / a GitHub Action that replaces
the content between the `<!-- sponsors -->` markers. The sponsor link will only
resolve to the GitHub Sponsors page once the czsoftcode Sponsors profile is
approved and published (currently pending review).
