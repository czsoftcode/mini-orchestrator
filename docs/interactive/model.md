# `/mini:model`

> View or set the Claude model for the project.

**CLI variant:** [`mini model`](../non-interactive/model.md) — the full
scope/preset reference.

**Argument hint:** `[show | reset | <scope> <model>]`

## What it does

`/mini:model` views and sets the Claude model used for the project's mini steps
(stored in `.mini/state.json`). There is a `default` model and optional
per-**scope** overrides (`default`, `next`, `plan`, `do`, `importGsd`, `audit`,
`memory`). A model is a preset (`opus` | `sonnet` | `haiku`) or a full ID.

## In a session

- If your arguments already form a complete command (e.g. `do opus`, `show`,
  `reset`, `sonnet`), Claude runs `mini model <args>` and relays the output.
- If they're empty or name only a scope, Claude first runs `mini model show`,
  asks which scope and model you want, and only then sets it — it never runs the
  interactive picker form in the non-interactive Bash.

## Example

```text
You:    /mini:model do opus
Claude: [mini model do opus] do = opus.

You:    /mini:model
Claude: [mini model show] default = opus, no overrides. Which scope and model?
You:    plan → sonnet
Claude: [mini model plan sonnet] plan = sonnet.
```

## Related

- [`mini model`](../non-interactive/model.md) — CLI variant
- [`/mini:status`](status.md) — shows the configured models
