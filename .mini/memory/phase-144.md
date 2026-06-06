# Phase 144 — README: move plan-mode section up

**Goal:** Move the 'How is this different from Claude Code's plan mode?' section from below Installation to directly after 'See it in action' (above Quick start), so the why-use-this argument precedes the install steps; relocation only, no content change. Fix the stale CHANGELOG Unreleased wording that says the section sits between Installation and Commands.

## Steps
- [done] Move the plan-mode section above Quick start
- [done] Fix stale CHANGELOG wording
- [done] Verify order and integrity

## Auto-commit
- Phase 144: README: move plan-mode section up

## Run report
---
phase: 144
verdict: done
steps:
  - title: "Move the plan-mode section above Quick start"
    status: done
  - title: "Fix stale CHANGELOG wording"
    status: done
  - title: "Verify order and integrity"
    status: done
verify:
  - title: "Read the README top-to-bottom flow — does 'How is this different' sit well between the demo and Quick start?"
    detail: "Pure relocation, no wording change. The argument now precedes install steps (as the feedback wanted), at the cost of pushing Quick start further down. Subjective read on whether the flow demo → comparison → quick start feels right."
---

# Phase 144 — report from the auto session

Moved the plan-mode comparison section up, as a clean cut-and-paste (no wording change).

- New section order: **See it in action → How is this different from Claude Code's plan mode? → Quick start → Requirements → Installation → Commands → …** So the "why use this over the built-in plan mode" argument now lands right after the demo, above the install steps.
- Fixed the stale `## [Unreleased]` CHANGELOG entry (from when the section was added) that described it as sitting "between Installation and Commands" — now "above the install steps, right after the demo".

**Verified mechanically:** the heading appears exactly once (no duplicate left behind), the comparison table is intact (header + 5 rows: Scope/Persistence/Memory/Git/Autonomy), no double blank lines at either seam, section order confirmed via the heading list. README stays 321 lines (a pure relocation, no net add/remove). Only `.md` files changed — no typecheck/tests relevant.

No real rejected alternative, so no ADR.

**Open question for the human:** does the top-to-bottom flow read well now (see `verify`)? The trade-off is deliberate — argument before install, at the cost of a longer scroll to Quick start.

**Campaign status:** README 396 → 321. Remaining in block C: drop the duplicate text transcript in "See it in action" (next phase). Then block A (remove CI/billing comment, trim the 3× illustrative disclaimers, verify the GIF) and block D (final length check).
