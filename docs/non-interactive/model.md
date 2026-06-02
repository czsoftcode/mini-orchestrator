# `mini model`

> Views or sets the Claude model used for the project's mini steps.

**Interactive variant:** [`/mini:model`](../interactive/model.md) — the slash
command shows the current setup and asks which scope/model when you don't give a
complete command.

## Synopsis

```bash
mini model                       # interactive picker (asks scope + model)
mini model show                  # print the current setup
mini model <model>               # set the default model
mini model <scope> <model>       # set a per-scope override
mini model <scope> default       # clear a scope override
mini model reset                 # clear everything
```

## Description

The model is stored in `.mini/state.json`. There is a `default` model and
optional per-**scope** overrides for the steps that spawn Claude. A `<model>` is
either a preset (`opus` | `sonnet` | `haiku`) or a full model ID (e.g.
`claude-sonnet-4-6`).

**Scopes:** `default`, `next`, `plan`, `do`, `importGsd`, `audit`, `memory`.

## Examples

```bash
$ mini model show
default = opus
  (no scope overrides)

$ mini model do opus
[ok] do = opus

$ mini model sonnet
[ok] default = sonnet

$ mini model do default
[ok] do override cleared (inherits default)

$ mini model reset
[ok] Model configuration cleared.
```

## Notes

- A bare `mini model`, or `mini model <scope>` without a value, opens an
  interactive picker — **avoid those in a non-interactive shell**; use
  `mini model show` plus an explicit `mini model <scope> <model>` instead.
- `mini model <model>` with the scope omitted sets the **default**.
- Setting a scope to `default` clears the override so it inherits the default
  again.

## Related

- [`/mini:model`](../interactive/model.md) — interactive variant
- [`mini status`](status.md) — shows the configured models
