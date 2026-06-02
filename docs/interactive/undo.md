# `/mini:undo`

> Revert the last state change by one step.

**CLI variant:** [`mini undo`](../non-interactive/undo.md) — the terminal command;
the slash command always uses its `--dry-run` and `--yes` forms.

## What it does

`/mini:undo` reverts the **last** state change (a phase/step status move, and a
soft-reset of the auto-commit when there was one). Mini remembers only one step
back, so this is a one-shot, irreversible action — the slash command confirms
with you before applying.

## In a session

1. **Preview** — Claude runs `mini undo --dry-run` and relays what would be
   reverted.
2. **Confirm** — it asks whether to proceed and **waits for your answer**.
3. **Apply** — only after you confirm, it runs `mini undo --yes`. If you
   decline, nothing changes.

> The slash command never runs a bare `mini undo` — that would block on a Y/n
> prompt in the non-interactive Bash.

## Example

```text
You:    /mini:undo
Claude: [mini undo --dry-run] Would revert phase 12 done → planned and
        soft-reset its commit. Proceed? (cannot be undone again)
You:    yes
Claude: [mini undo --yes] Reverted one step.
```

## Related

- [`mini undo`](../non-interactive/undo.md) — CLI variant
- [`/mini:done`](done.md) — the kind of change you might undo
