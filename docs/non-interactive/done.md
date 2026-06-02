# `mini done`

> Human verification — confirms the phase works and moves the state forward.

**Interactive variant:** [`/mini:done`](../interactive/done.md) — the slash
command runs the verification in the session and then calls this with `--apply`
(plus any version switches).

## Synopsis

```bash
mini done                                    # interactive: asks whether it works, then moves the state
mini done --apply                            # non-interactively move the state per the report
mini done --apply --bump patch               # …and bump the version
mini done --apply --bump minor --push        # …and push (tag) to the remote
mini done --apply --accept-verify            # …treat manual-verification items as approved
```

## Description

`mini done` closes the current phase: it reads the report from
`.mini/run/phase-<id>.md`, moves the phase and its steps to their final state,
commits the changes, and optionally bumps the version and pushes. Run bare it
asks for confirmation interactively; with `--apply` it moves the state from the
report without questions — the form the slash command uses.

## Options

| Flag | Description |
| --- | --- |
| `--apply` | Non-interactively move the state according to the report (no questions). |
| `--accept-verify` | With `--apply`: treat items flagged for manual verification as approved (verification happened in the chat). |
| `--bump <level>` | Version bump in `package.json` when closing: `none` \| `patch` \| `minor` \| `major`. **Default `none`** (no bump). |
| `--push` | After committing, push to the remote (`git push`). **Requires `--bump patch \| minor \| major`.** |

## Examples

Close a phase and bump the patch version:

```bash
$ mini done --apply --bump patch
[ok] Phase 12 closed. Version 1.12.0 → 1.12.1.
```

`--push` without a real bump is refused (there would be nothing to tag):

```bash
$ mini done --apply --push
With --push you must choose a version level: --bump patch | minor | major.
```

## Notes

- The default bump is `none` — closing a phase does **not** change the version
  unless you ask for it.
- `--push` also creates the version tag, so it requires an explicit
  `--bump patch | minor | major`; combining it with `--bump none` exits with an
  error.
- Items flagged in the report's `verify` list block an automatic close unless
  you pass `--accept-verify` (only after a human actually reviewed them).

## Related

- [`/mini:done`](../interactive/done.md) — interactive variant
- [`mini do`](do.md) — produces the report this reads
- [`mini verify`](verify.md) — human review before closing
- [`mini undo`](undo.md) — revert a `done` you regret
