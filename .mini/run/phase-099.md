---
phase: 99
verdict: done
steps:
  - title: "next prompt offers to stash ideas into todo"
    status: done
  - title: "/mini:todo suggest action"
    status: done
  - title: "README and CHANGELOG"
    status: done
---

# Phase 99 — report from the auto session

Closed the loop between the `next` step and the todo archive: Claude's ideas can
now feed the backlog without the user starting a phase or hunting elsewhere.

## What was done
- **next prompt** (`prompts/sessionContext.ts`): in the no-hint ("leave it to me")
  path, the `# Ask first` block now tells Claude to sketch **2-3** candidate ideas,
  propose the most sensible one as the phase, and offer to stash the rest into the
  archive via `mini todo add "<text>"` (after approval). Two prompt tests assert
  the instruction appears without a `userHint` and is absent with one.
- **`/mini:todo suggest`** (`install/commands.ts`): the slash command body gained a
  `suggest` (alias `ideas`) action — Claude reviews the project (project.md,
  `mini status`, the machine map), checks the current archive to avoid duplicates,
  proposes 3-5 small concrete ideas and writes them straight in with `mini todo add`.
  The `argument-hint` now lists `suggest`; the install-commands test asserts it.
- **Docs**: README slash list + the `mini todo` table row, and a CHANGELOG `Added`
  entry (English, stays under `[Unreleased]`).

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**792 tests**).
- The token-measure snapshots were intentionally updated: only the `next` prompt
  grew (template 531 → 585 tokens) from the new instruction; the injected context
  is unchanged.
- Visual check: `mini context next` renders the new "sketch 2-3 / stash the rest
  with `mini todo add`" instruction in the `# Ask first` block.

## Notes
- The `suggest` action lives in the slash-command body (not a `mini todo`
  sub-command) because generating ideas needs Claude — the deterministic CLI has
  no model. The mechanical `mini todo add/done/remove/list` stay unchanged.
