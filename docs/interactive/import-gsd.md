# `/mini:import-gsd`

> Import a GSD project from `.planning/` into mini (one-off).

**CLI variant:** [`mini import-gsd`](../non-interactive/import-gsd.md).

## What it does

`/mini:import-gsd` migrates a work-in-progress GSD project — one that keeps its
plan under `.planning/` — into a mini project under `.mini/`. The session's
Claude reads `.planning/` itself, extracts the project description and the list
of phases **with their statuses preserved** (`done` / `doing` / `proposed` /
`skipped`), and saves everything via `mini import-gsd --apply`.

It is a **one-off setup** step, typically run instead of [`/mini:init`](init.md)
when migrating an existing GSD project. Unlike the bare terminal command, it
spawns **no nested Claude** — the session you are already in does the reading and
extraction, then pipes the result into the non-interactive `--apply` form.

## In a session

1. **Check the source.** Claude confirms `.planning/` exists; if it is missing
   there is nothing to import and it stops.
2. **Check for an existing project.** If `.mini/` already holds a project, Claude
   warns that importing **overwrites** it (the phase history is lost) and asks
   you to confirm. It only continues with your approval (then passing `--force`).
3. **Get the prompt.** Claude runs `mini import-gsd --prompt` to obtain the
   extraction instructions and the strict response contract.
4. **Extract.** Claude reads the `.planning/` files (read-only) and builds the
   response in exactly that contract.
5. **Save.** Claude pipes the response into `mini import-gsd --apply` (with
   `--force` when overwriting a confirmed project), which parses it and writes
   `.mini/`.
6. **Relay.** Claude reports the imported project and phases.

## Example

```text
You:    /mini:import-gsd
Claude: Found .planning/. Reading the GSD plan…
        Imported "todo-api" — 8 phases (5 done, 1 doing, 2 todo).
        Run /mini:status to review them, then /mini:next to continue.
```

## Notes

- Importing **overwrites** any existing mini project; only the model
  configuration ([`/mini:model`](model.md)) is carried over.
- After it succeeds, review the result with [`/mini:status`](status.md) and
  continue the phase loop with [`/mini:next`](next.md).

## Related

- [`mini import-gsd`](../non-interactive/import-gsd.md) — CLI variant
- [`/mini:init`](init.md) — the regular project setup (when there is no GSD plan)
- [`/mini:status`](status.md) — review the imported phases
- [`/mini:next`](next.md) — continue the phase loop after import
