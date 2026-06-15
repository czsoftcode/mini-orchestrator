# Phase 178 — Visible security reminder in adversarial-project

**Goal:** Add an explicit, reminder-only line at the end of the adversarial-project flow (closing status block in the prompt and/or the slash-command body) telling the human to run a separate security pass — it never auto-runs and never files security findings into mini.

## Steps
- [done] Add reminder to prompt closing block
- [done] Align stale in-body security reference
- [done] Add reminder to slash-command body
- [done] Update prompt tests
- [done] Add slash-command body test
- [done] Verify build, typecheck and tests pass

## Auto-commit
- Phase 178: Visible security reminder in adversarial-project

## Run report
---
phase: 178
verdict: done
steps:
  - title: "Add reminder to prompt closing block"
    status: done
  - title: "Align stale in-body security reference"
    status: done
  - title: "Add reminder to slash-command body"
    status: done
  - title: "Update prompt tests"
    status: done
  - title: "Add slash-command body test"
    status: done
  - title: "Verify build, typecheck and tests pass"
    status: done
---

# Phase 178 — report from the auto session

## What was done
The `adversarial-project` flow now ends with an explicit, reminder-only security
nudge, and the stale `/security-review` reference was replaced by the project's own
pass.

- **Prompt closing block** (`src/prompts/sessionContext.ts`): added a new
  `# Reminder — security is still a separate pass` section right after the status
  line. It tells the human (not the agent) that the review covered correctness only
  and that, **once the phase is done and committed**, they should run `mini security`
  in a **separate terminal** — clean context, its own report. It is a reminder only:
  the prompt does not run it and does not file security into `mini findings`.
- **In-body alignment**: the existing `# Security is out of scope here` section no
  longer points to the built-in `/security-review`; it now names the project's own
  `mini security` pass. This removes a reference that predated the mini-native
  security command (phases 169–172) — the adversarial-project prompt was written
  earlier (163–168).
- **Slash-command body** (`src/install/commands.ts`): added a matching one-line
  reminder to the `/mini:adversarial-project` body — correctness only, run
  `mini security` separately in another terminal after done.

## Why post-done + separate terminal (and not inline `/mini:security`)
Per the discussion: `mini security` resolves a phase range and reads the **git diff**,
so it only makes sense over a **committed** range. Running it inline in this session
would also share the author's blind spots and the uncommitted working tree. The
reminder therefore points at the terminal pass after `done`, not at an inline run.

## Tests / verification (all mechanical, verified here)
- `src/prompts/sessionContext.test.ts`: rewrote the old "delegates to /security-review"
  test to assert `mini security` is named and `/security-review` is **gone**; added a
  test that the closing reminder block mentions "separate pass", "done and committed",
  "separate terminal" and `mini security`.
- `src/install/commands.test.ts`: added an `adversarial-project slash command` block
  asserting the body reminds about the separate `mini security` pass.
- `npm run build` ✔, `tsc --noEmit` ✔, full `vitest run` ✔ (87 files, 1205 tests).

## Honest gap / possible follow-up (out of scope here)
The internal design doc `docs/adversarial-project-task.md` (Czech) still references
`/security-review` in three places (lines ~159, 187, 248–249). It was outside this
phase's scope (prompt + slash-command + tests), so I did **not** touch it — but it is
now inconsistent with the code. The user-facing `docs/interactive/` and
`docs/non-interactive/` adversarial-project pages do not mention security, so they
need no change. The doc drift could be a small follow-up todo if you want the design
note to match.
