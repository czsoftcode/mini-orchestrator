---
phase: 123
verdict: done
steps:
  - title: "todoStore: helper markTodoDone(n)"
    status: done
  - title: "next --apply --from-todo <n> flag"
    status: done
  - title: "Backlog block shows archive numbers + instruction"
    status: done
  - title: "Docs + snapshots"
    status: done
---

# Phase 123 — report from the auto session

## What was delivered

`mini next --apply` now takes an optional `--from-todo <n>` that ticks off the
backlog item the phase was born from, and the `/mini:next` prompt guides Claude
to pass it.

- **`markTodoDone(n, cwd)`** in `src/state/todoStore.ts` — ticks an item by its
  1-based archive position (counted over *all* items, same numbering as
  `mini todo done <n>`). Returns a discriminated result
  `'ticked' | 'already-done' | 'out-of-range' | 'no-todos'` (+ item text). Never
  throws on a bad reference. Reuses `read/writeTodos`. Unit-tested.
- **`applyNewPhase(title, goal, { fromTodo?, cwd? })`** — signature changed from a
  bare `cwd` 3rd arg to an options object. After a successful save it calls
  `markTodoDone`; a bad reference is a `log.warn`/`log.dim` only, never a failure
  (the phase is already committed). CLI option `--from-todo <n>` wired in
  `src/cli.ts`.
- **Backlog block** now carries each open item's 1-based archive index
  (`OpenTodo { index, text }`), renders it as `- [n] text`, and the save
  instruction tells Claude to append `--from-todo <n>`. `context.ts` computes the
  index over the full list before filtering to open items, so the number matches
  the archive.
- **Docs**: `docs/non-interactive/next.md` (synopsis, options table, notes),
  `docs/non-interactive/todo.md` and `docs/interactive/next.md` cross-references.

## Verification (all mechanical, done here)

- `npm run typecheck` — clean.
- `npm test` — 876 passed. Updated the two `src/tokens/measure.test.ts`
  snapshots (the `next` template grew by the one-line `--from-todo` instruction;
  expected).
- `npm run build` — clean.
- **End-to-end** on a throwaway project via the built `dist/cli.js`:
  `--from-todo 3` ticked off item 3 while a `[x]` item sat at position 1 (proves
  the numbering counts done items); an out-of-range `--from-todo 99` warned but
  still saved the phase with exit 0.

## Notes / deviations

- The plan named `next.test.ts` for the flag test, but `applyNewPhase`'s tests
  already live in `src/commands/apply.test.ts` (next.test.ts only covers the
  `TITLE:`/`GOAL:` parser). I added the two new cases there — the canonical home.
- The biome default config flags tab-vs-space, but the project has no
  lint/format step (CI runs typecheck + test + build only) and uses 2-space
  indent; the new code matches the surrounding style, so biome was ignored.
