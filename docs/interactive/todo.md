# `/mini:todo`

> Archive of future ideas and changes.

**CLI variant:** [`mini todo`](../non-interactive/todo.md) — the full action
reference.

**Argument hint:** `[list | add <text> | edit <n> <text> | done <n> | remove <n> | clear | suggest]`

## What it does

`/mini:todo` manages the project's idea backlog (`.mini/todo.md`). It maps your
arguments to a non-interactive `mini todo` call and relays the output. The open
items are later offered by [`/mini:next`](next.md) as candidate phase ideas.

## In a session

| You type | Claude runs |
| --- | --- |
| `list` (or nothing) | `mini todo` |
| `add <text>` | `mini todo add "<text>"` |
| `edit <n> <text>` | `mini todo edit <n> "<text>"` |
| `done <n>` | `mini todo done <n>` |
| `remove <n>` / `rm <n>` | `mini todo remove <n>` |
| `clear` | `mini todo clear` (drops done items) |
| `suggest` / `ideas` | **Claude proposes** 3–5 fresh ideas and writes them in |

The `suggest` action is special: Claude reviews the project (project.md, phase
history, the graph), proposes 3–5 small verifiable ideas without duplicating
existing ones, and appends each with `mini todo add`.

## Example

```text
You:    /mini:todo add rate-limit the /todos endpoint
Claude: [mini todo add …] Added idea #4. (3 open / 4 total)

You:    /mini:todo suggest
Claude: Proposed: ETag caching · bulk delete · request logging. Adding them…
```

## Related

- [`mini todo`](../non-interactive/todo.md) — CLI variant
- [`/mini:next`](next.md) — offers open items as phase candidates
