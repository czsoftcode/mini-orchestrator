# `mini init`

> Creates a new mini-orchestrator project in the current directory.

**Interactive variant:** [`/mini:init`](../interactive/init.md) — the slash
command asks you the four questions in the session and then calls this with
`--apply`.

## Synopsis

```bash
mini init                       # interactive: asks the four questions in the terminal
mini init --apply --what "…" --for-whom "…" [--name "…"] [--constraints "…"] [--force]
```

## Description

`mini init` scaffolds the `.mini/` state directory: `state.json`, `project.md`
(name / what / for whom / constraints), and the empty `phases/`, `discuss/`,
`run/`, `memory/` subdirectories. After it runs, the project is ready for the
phase loop ([`mini next`](next.md)).

Run bare, it asks the four questions interactively in the terminal. With
`--apply` it creates the project straight from flags and asks nothing — this is
the form the slash command uses once it has collected your answers in the chat.

## Options

| Flag | Description |
| --- | --- |
| `--apply` | Non-interactively create the project from the flags below (no questions). |
| `--name <name>` | Project name. Defaults to the directory name when omitted. |
| `--what <what>` | What you are building (1–2 sentences). **Required with `--apply`.** |
| `--for-whom <forWhom>` | Who it is for (the target user). **Required with `--apply`.** |
| `--constraints <constraints>` | Main constraints (language / framework / deadline). Optional. |
| `--force` | Overwrite an existing `.mini/` project without asking (the old phase history is lost). |

## Examples

Create a project non-interactively:

```bash
$ mini init --apply --name "todo-api" \
    --what "A small REST API for managing todos" \
    --for-whom "Backend developers" \
    --constraints "TypeScript, Fastify"
[ok] Project created in .mini/
```

Re-running on an existing project is refused unless you confirm with `--force`:

```bash
$ mini init --apply --what "…" --for-whom "…"
[error] A project already exists in .mini/. Re-run with --force to overwrite (the phase history will be lost).
```

## Notes

- `--what` and `--for-whom` are required with `--apply`; omitting them exits
  with an error.
- In a **brownfield** repo (there is already code), follow init with
  [`mini map`](map.md) and [`mini audit`](audit.md) so later sessions have a
  project graph and a codebase overview. In an **empty** directory, go straight
  to [`mini next`](next.md).
- Never edit `.mini/state.json` or `.mini/project.md` by hand — let the
  `--apply` commands manage them.

## Related

- [`/mini:init`](../interactive/init.md) — interactive variant
- [`mini map`](map.md), [`mini audit`](audit.md) — brownfield follow-ups
- [`mini next`](next.md) — propose the first phase
