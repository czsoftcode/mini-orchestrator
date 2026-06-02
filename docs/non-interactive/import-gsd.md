# `mini import-gsd`

> One-off import of an in-progress GSD project from `.planning/` into mini.

**Interactive variant:** [`/mini:import-gsd`](../interactive/import-gsd.md) — the
slash command drives the import from inside a Claude Code session and calls the
`--prompt` / `--apply` forms under the hood.

## Synopsis

```bash
mini import-gsd                 # interactive: reads .planning/ via Claude, previews, asks to confirm
mini import-gsd --prompt        # print the extraction prompt + response contract and exit
mini import-gsd --apply [--force] < response   # parse a contract from stdin and save the project
```

## Description

`mini import-gsd` migrates a work-in-progress GSD project — one that keeps its
plan under `.planning/` — into a mini project under `.mini/`. It extracts the project's name, what it builds, who it is for and its
constraints, plus the list of phases **with their statuses preserved**
(`done` / `doing` / `proposed` / `skipped`), so the imported history lines up
with the phase overview in [`mini status`](status.md).

It is a **one-off setup** step, run instead of [`mini init`](init.md) when the
project already exists as GSD. After it succeeds the project is ready for the
phase loop ([`mini next`](next.md)).

The command has three forms:

- **Bare `mini import-gsd`** — the interactive terminal flow. It checks for
  `.planning/`, asks before overwriting an existing project, spawns a short
  Claude pass (`Read` / `Glob` / `Grep` only) to read `.planning/` and build the
  contract, prints a preview, and asks you to confirm before writing `.mini/`.
- **`--prompt`** — prints the extraction instructions and the strict response
  contract (`NAME:` / `WHAT:` / `FOR_WHOM:` / `CONSTRAINTS:` plus a `PHASES:`
  table) to stdout and exits. No Claude is spawned and no project is required.
  This is what the slash command runs to get the prompt.
- **`--apply`** — reads an extraction response from **stdin**, parses the
  contract, preserves the phase statuses and writes `.mini/`. No Claude is
  spawned. This is the form the slash command pipes its response into.

## Options

| Flag | Description |
| --- | --- |
| `--prompt` | Print the GSD extraction prompt + response contract to stdout and exit (no Claude, no project needed). For [`/mini:import-gsd`](../interactive/import-gsd.md). |
| `--apply` | Read the extraction response from stdin, parse it and save the project + phases (no Claude). For [`/mini:import-gsd`](../interactive/import-gsd.md). |
| `--force` | With `--apply`: overwrite an existing project (its model config is preserved). |

## Examples

Print the extraction prompt (e.g. to inspect the contract):

```bash
$ mini import-gsd --prompt
… extraction instructions …

Reply in EXACTLY this format:
NAME: …
WHAT: …
FOR_WHOM: …
CONSTRAINTS: …

PHASES:
1 | done | …
2 | doing | …
```

Save a contract non-interactively from a heredoc:

```bash
$ mini import-gsd --apply <<'EOF'
NAME: todo-api
WHAT: A small REST API for managing todos
FOR_WHOM: Backend developers
CONSTRAINTS: TypeScript, Fastify

PHASES:
1 | done | Project scaffold
2 | doing | CRUD endpoints
EOF
[ok] Project imported into .mini/
```

Re-running `--apply` on an existing project is refused unless you pass `--force`
(the existing model config is preserved):

```bash
$ mini import-gsd --apply < response
[error] A project already exists in .mini/. Re-run with --force to overwrite.
```

## Notes

- The bare form is **interactive** (it asks Y/n to overwrite and to confirm the
  import), so run it in a real terminal. Inside a Claude Code session use the
  [`/mini:import-gsd`](../interactive/import-gsd.md) slash command, which uses
  the non-interactive `--prompt` / `--apply` forms instead.
- Importing **overwrites** any existing mini project — the previous phase
  history is lost. The model configuration (`mini model`) is the only thing
  carried over.
- Never edit `.mini/state.json` or `.mini/project.md` by hand — let the
  `--apply` form write them.

## Related

- [`/mini:import-gsd`](../interactive/import-gsd.md) — interactive variant
- [`mini init`](init.md) — the regular project setup (when there is no GSD plan)
- [`mini status`](status.md) — review the imported phases
- [`mini next`](next.md) — continue the phase loop after import
