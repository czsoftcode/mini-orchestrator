# `mini todo`

> Archive of future ideas and changes (`.mini/todo.md`).

**Interactive variant:** [`/mini:todo`](../interactive/todo.md) — the slash
command maps its arguments to these calls and can also **suggest** new ideas.

## Synopsis

```bash
mini todo                       # list items (same as "mini todo list")
mini todo list
mini todo add "<text>"          # append a new open idea
mini todo edit <n> "<text>"     # rewrite item n's text (keeps its done state)
mini todo done <n>              # tick item n off
mini todo remove <n>            # drop item n   (alias: rm)
mini todo clear                 # drop all done items at once
```

## Description

A plain-markdown checklist of ideas you don't want to start as a phase yet. The
open items are offered by [`mini next`](next.md) as candidate phase ideas. The
`<n>` is the 1-based position from the listing. It changes **no** phase state.

## Examples

```bash
$ mini todo add "Rate-limit the /todos endpoint"
[ok] Added idea #4.

$ mini todo
Ideas & changes
  1. [x] Pagination for /todos
  2. [ ] Bulk delete endpoint
  3. [ ] ETag caching
  4. [ ] Rate-limit the /todos endpoint
  3 open / 4 total
  Actions: list · add "<text>" · edit <n> "<text>" · done <n> · remove <n> · clear

$ mini todo done 2
[ok] Item 2 ticked off.

$ mini todo clear
[ok] Removed 2 done items.
```

## Notes

- Numbers are the positions shown by the listing; they shift after `remove` /
  `clear`, so list again before acting on a number.
- `clear` removes **done** items only — it is housekeeping, not a wipe.
- The interactive `/mini:todo suggest` is special: there, Claude reviews the
  project and writes 3–5 fresh ideas into the archive for you.

## Related

- [`/mini:todo`](../interactive/todo.md) — interactive variant (incl. `suggest`)
- [`mini next`](next.md) — offers open items as phase candidates
