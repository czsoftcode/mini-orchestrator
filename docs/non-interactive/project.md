# `mini project`

> Enriches an existing `project.md` with Approach, Non-goals and Success criteria.

**Interactive variant:** [`/mini:project`](../interactive/project.md) — the slash
command runs the plan-before-code session in the chat and then calls this with
`--apply`.

## Synopsis

```bash
mini project                    # interactive: a project-shaping session in the terminal
mini project --apply            # reads the contract from stdin (no Claude)
```

## Description

`mini project` runs **after** [`mini init`](init.md). Init records a terse
`project.md`; `mini project` keeps the existing name / target user / constraints
and **adds** the steering sections that tell the agent *how* to approach the work
and *where not to go*: **Approach**, **Non-goals**, **Success criteria**.

`project.md` stays a **one-page steering doc** — only the main points are written,
not a full spec. The command enriches an existing project; it does **not** create
one (run [`mini init`](init.md) first) and it touches **only** `project.md`, never
`state.json`.

Run bare, it opens an interactive Claude Code session (the agent may run Bash so
it can save the result itself). With `--apply` it reads a contract from stdin,
parses it and writes `project.md` — no Claude, no questions. This is the form the
slash command uses once it has agreed the draft with you in the chat.

## Options

| Flag | Description |
| --- | --- |
| `--apply` | Non-interactively read the project contract from stdin, parse it and write only `project.md` (no Claude). |

## Contract format (`--apply`)

The contract is a block of `LABEL:` sections; each label starts at the **start of
a line** and its value runs until the next label or end of input (so the bullet
sections can span multiple lines). `NAME` and `WHAT` are required; an optional
section is omitted entirely when empty.

```bash
mini project --apply <<'EOF'
NAME: todo-api
WHAT: A small REST API for managing todos
FOR_WHOM: Backend developers
CONSTRAINTS: TypeScript, Fastify
APPROACH:
- Thin HTTP layer over a single SQLite table
- One resource (todos) before any auth
NON_GOALS:
- Do not add multi-user accounts in this version.
- Do not add a web UI in this version.
SUCCESS:
- A developer can CRUD todos via curl in under a minute
EOF
```

`--apply` does a **full replace** of `project.md` from the contract — re-send the
existing `NAME` / `FOR_WHOM` / `CONSTRAINTS` so they are not lost. It exits with an
error if `NAME` or `WHAT` is missing, or if there is no project yet.

## Notes

- Never edit `.mini/project.md` by hand — let `--apply` manage it.
- The headings (`# <name>`, `## What I'm building`) are preserved so
  [`mini status`](status.md) keeps working.

## Related

- [`/mini:project`](../interactive/project.md) — interactive variant
- [`mini init`](init.md) — create the project first
- [`mini next`](next.md) — propose the next phase
