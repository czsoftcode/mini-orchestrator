# `mini undo`

> Reverts the last state change by one step.

**Interactive variant:** [`/mini:undo`](../interactive/undo.md) — the slash
command previews with `--dry-run`, asks you to confirm, and only then runs
`--yes`.

## Synopsis

```bash
mini undo             # interactive: prompts Y/n before reverting
mini undo --dry-run   # preview what would be reverted, change nothing
mini undo --yes       # revert directly, no prompt
```

## Description

Mini remembers only **one** step back, so `mini undo` is a one-shot,
irreversible action: it reverts the last state change (a phase/step status move)
and, when the last change was an auto-commit, soft-resets that commit. Run bare
it asks for confirmation; `--dry-run` only previews; `--yes` reverts without a
prompt.

## Options

| Flag | Description |
| --- | --- |
| `--dry-run` | Preview only — print what would be reverted and exit, without prompting or changing anything. |
| `--yes` | Skip the confirmation and revert directly (non-interactive). |

## Examples

```bash
$ mini undo --dry-run
Would revert: phase 12 "Pagination for /todos" done → planned
Would soft-reset auto-commit: "Phase 12: Pagination for /todos"

$ mini undo --yes
[ok] Reverted one step.
```

## Notes

- **Don't run a bare `mini undo` in a non-interactive shell** (e.g. the Claude
  Code Bash tool) — it blocks on the Y/n prompt. Use `--dry-run` then `--yes`.
- It reverts only **one** step and cannot itself be undone — preview first.

## Related

- [`/mini:undo`](../interactive/undo.md) — interactive variant
- [`mini done`](done.md) — the kind of change you might undo
