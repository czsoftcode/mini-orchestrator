# `/mini:init`

> Start a new mini-orchestrator project — the questions happen in the session.

**CLI variant:** [`mini init`](../non-interactive/init.md) — the terminal
command this slash command calls with `--apply` once it has your answers.

## What it does

`/mini:init` scaffolds a new project's `.mini/` state in the current directory.
Unlike the terminal form, it gathers the project details **conversationally**
and then saves them for you.

## In a session

1. Claude asks you four short things in the chat: **project name** (optional,
   defaults to the directory name), **what it builds** (1–2 sentences), **who
   it's for**, and the **main constraints** (optional).
2. It saves the project by calling
   `mini init --apply --name … --what … --for-whom … --constraints …`. If a
   project already exists, it only overwrites with `--force` **after you
   confirm** (the old phase history would be lost).
3. It offers the next steps based on whether the directory already has code:
   - **brownfield** (code present) → [`/mini:map`](map.md) then
     [`/mini:audit`](audit.md),
   - **empty** → [`/mini:next`](next.md) to propose the first phase.

## Example

```text
You:    /mini:init
Claude: What is the project name? What does it build? Who is it for?
        Any main constraints?
You:    todo-api · a small REST API for todos · backend devs · TypeScript, Fastify
Claude: [runs mini init --apply …] Project created. Since the directory is
        empty, run /mini:next to propose the first phase.
```

## Related

- [`mini init`](../non-interactive/init.md) — CLI variant
- [`/mini:map`](map.md), [`/mini:audit`](audit.md) — brownfield follow-ups
- [`/mini:next`](next.md) — propose the first phase
