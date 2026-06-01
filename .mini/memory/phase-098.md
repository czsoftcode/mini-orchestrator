# Phase 98 — Nápověda akcí ve výpisu mini todo

**Goal:** When 'mini todo' lists items (and thus via /mini:todo), it appends a short one-line hint of the available actions (add "<text>" / done <n> / remove <n>) so the user does not have to recall them; the existing empty-archive message keeps its add hint; covered by a unit test.

## Steps
- [done] Append actions hint to todo listing
- [done] Test the listing hint

## Auto-commit
- Phase 98: Nápověda akcí ve výpisu mini todo

## Run report
---
phase: 98
verdict: done
steps:
  - title: "Append actions hint to todo listing"
    status: done
  - title: "Test the listing hint"
    status: done
---

# Phase 98 — report from the auto session

Small follow-up to phase 97 (came from the `mini todo` archive itself).

## What was done
- `commands/todo.ts` `list()`: after the `N open / M total` summary it now prints
  a dim one-line hint of the available actions —
  `Actions: add "<text>" · done <n> · remove <n>` — so the user doesn't have to
  recall the sub-commands. The empty-archive branch keeps its existing
  `mini todo add "<text>"` hint unchanged.
- `commands/todo.test.ts`: two new tests capturing `console.log` assert the
  actions hint appears when items exist and the add hint shows on an empty archive.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**790 tests**).
- Visual check on this project: `mini todo` prints the list, the `1 open / 1 total`
  summary and the new `Actions: …` hint line.
