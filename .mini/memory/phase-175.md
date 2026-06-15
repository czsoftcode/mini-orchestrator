# Phase 175 — Allow findings list in adversarial-project

**Goal:** Add 'Bash(mini findings list:*)' to ADVERSARIAL_PROJECT_ALLOWED_TOOLS in src/commands/adversarialProject.ts so the prompt-instructed dedup step (mini findings list) in the reviewer session does not trigger a permission prompt, and update the pinning test of allowed tools.

## Steps
- [done] Add findings list to allowed tools
- [done] Update allowed-tools pinning test
- [done] Verify build, typecheck and tests pass

## Auto-commit
- Phase 175: Allow findings list in adversarial-project

## Run report
---
phase: 175
verdict: done
steps:
  - title: "Add findings list to allowed tools"
    status: done
  - title: "Update allowed-tools pinning test"
    status: done
  - title: "Verify build, typecheck and tests pass"
    status: done
---

# Phase 175 — report from the auto session

## What was done
- Added `'Bash(mini findings list:*)'` to `ADVERSARIAL_PROJECT_ALLOWED_TOOLS` in
  `src/commands/adversarialProject.ts`, placed right before `'Bash(mini findings add:*)'`
  (read-only step before the one write). The reviewer prompt instructs `mini findings list`
  for dedup (`sessionContext.ts:659`), so without this entry the terminal session would hit a
  permission prompt and the dedup step would silently not run.
- Updated the pinning test `src/commands/adversarialProject.test.ts` `toEqual` array to match
  the new set; `not.toContain('Edit')` is untouched.

## Verification
- `npm run typecheck` — clean.
- `npm run build` — clean.
- `npx vitest run` — 87 files / 1185 tests pass. No other snapshot/pinning test of the tool set
  broke (the allowed-tools set lives only in the command + its own pinning test; prompt snapshots
  don't embed it).

## Notes / scope
- `src/commands/adversarial.ts` (single-phase) was **deliberately left unchanged**: its prompt
  never instructs `mini findings list` (no dedup step), so adding the permission there would be
  dead scope. The two allowed-tools sets stay intentionally different, with separate pinning tests
  so each drifts independently.
- The top-of-constant comment ("the only write it can make is `mini findings add`") stays accurate
  — `list` is read-only.

No rejected design alternative worth an ADR.
