---
phase: 97
verdict: done
steps:
  - title: "Todo store and markdown format"
    status: done
  - title: "mini todo command"
    status: done
  - title: "next prompt surfaces open todos"
    status: done
  - title: "/mini:todo slash command"
    status: done
  - title: "README and CHANGELOG"
    status: done
---

# Phase 97 — report from the auto session

Added a project archive of future ideas and changes (`mini todo` + `/mini:todo`).

## What was done
- **Store + format** (`src/state/todoStore.ts`, `todoPath` in `store.ts`):
  `.mini/todo.md` is a human-readable markdown checklist (`- [ ]` open, `- [x]`
  done) with a fixed header. Pure `parseTodos`/`serializeTodos` (header lines are
  ignored on parse, so a hand-written header survives a round-trip) plus async
  `readTodos`/`writeTodos`. Round-trip + edge-case unit tests.
- **Command** (`src/commands/todo.ts`, registered as `mini todo [action] [args...]`):
  `mini todo` lists numbered items with an `open/total` summary; `add <text>`
  appends (joining args), `done <n>` / `remove <n>` (alias `rm`) act on the
  1-based index; invalid index / missing project / empty text are handled safely
  and TTY-free. Unit tests per sub-command.
- **next integration**: `buildNextSessionPrompt` gained an optional
  `openTodos` → a `# Ideas in the backlog` block listing open items as candidate
  ideas; `context.ts` loads `.mini/todo.md` and passes only the open items.
  Prompt tests for presence/absence.
- **Slash command**: a `todo` entry in `install/commands.ts` with its own body
  (maps `$ARGUMENTS` to the right `mini todo` call, never `mini context`).
  Updated the command-count assertions (14 → 15) in install/update tests and the
  command lists in README.
- **Docs**: README commands table row, the in-Claude slash list, the generated
  file list, and a CHANGELOG `Added` entry — all in English.

## Verification (mechanical)
- `npm run build` (strict `tsc`) clean; full suite green (**790 tests** after the
  new ones).
- End-to-end smoke test on a temp project: `add` × 2 → `done 1` → list shows
  `[x]`/`[ ]` with the `1 open / 2 total` summary; `.mini/todo.md` renders the
  checklist; `mini context next` surfaces only the open item under
  "Ideas in the backlog" (the done one is correctly omitted).

## Notes
- The next-phase backlog is intentionally a soft suggestion (a prompt block), not
  an auto-pick — the human still chooses, which keeps `/mini:auto`'s "stop and
  ask at next" contract intact while removing the blank-page problem.
