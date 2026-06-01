# Phase 100 — Údržba todo: edit, clear, status

**Goal:** Round out the ideas archive: add 'mini todo edit <n> "<text>"' to rewrite an existing item's text and 'mini todo clear' to drop all done items in one go, and show the open-todo count in 'mini status' (e.g. 'Ideas: N open'); each behaviour covered by unit tests.

## Steps
- [done] mini todo edit action
- [done] mini todo clear action
- [done] Open-todo count in mini status
- [done] README and CHANGELOG

## Auto-commit
- Phase 100: Údržba todo: edit, clear, status

## Run report
---
phase: 100
verdict: done
steps:
  - title: "mini todo edit action"
    status: done
  - title: "mini todo clear action"
    status: done
  - title: "Open-todo count in mini status"
    status: done
  - title: "README and CHANGELOG"
    status: done
---

# Phase 100 — report from the auto session

Rounded out the ideas archive (todo items 2-4 from `mini todo`, bundled into one
phase at the user's request).

## What was done
- **`mini todo edit <n> "<text>"`** (`commands/todo.ts`): rewrites an item's text
  in place, keeping its done state; reuses `parseIndex` for the range guard and
  warns on empty text. Two unit tests.
- **`mini todo clear`**: drops every ticked-off item in one go, with a no-op
  message when nothing is done. Two unit tests.
- **`mini status`**: a new `ideasSummaryLine(openCount)` helper prints
  `Ideas: N open (mini todo)` in the header, shown only when the archive has open
  items (empty archive adds no noise). Unit test for both branches.
- The listing's actions hint now reads
  `Actions: list · add "<text>" · edit <n> "<text>" · done <n> · remove <n> · clear`.
- **Docs**: README commands table + `/mini:todo` slash list, the slash body
  bullets and `argument-hint` (edit/clear), and a CHANGELOG `Added` entry.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**798 tests**).
- Smoke test on a temp project: `add` → `edit 1` (text changed) → `done 2` →
  `clear` (the one done item dropped, the open one kept); `mini status` header
  shows `Ideas: 1 open (mini todo)`.

## Notes
- No prompt text changed, so the token-measure snapshot is untouched.
- Source todo items 2, 3 and 4 are ticked off as part of closing this phase.
