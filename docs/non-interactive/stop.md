# `mini stop`

> Creates a cooperative stop signal that tells a running autonomous
> [`/mini:auto`](../interactive/auto.md) to finish the current step and exit
> cleanly.

> **Console-only.** This command has **no** `/mini:stop` slash variant — you run
> it in a terminal, typically a *second* one, while an autonomous run is busy in
> another. It is the one mini command with a single documentation page.

## Synopsis

```bash
mini stop            # create the stop signal (.mini/STOP)
mini stop --clear    # remove the stop signal
```

## Description

An autonomous run can't read a message you type into its busy session, so
stopping is **cooperative**: `mini stop` drops a `.mini/STOP` file. At its
checkpoints (between cycle steps, and after each finished step in `do`) the
autonomous loop checks for that file — and when it finds it, it finishes the
step in progress, writes the report, and ends with "Stopped on request". You
clear the signal afterwards with `--clear`.

## Options

| Flag | Description |
| --- | --- |
| `--clear` | Remove the stop signal instead of creating it. |

## Examples

Ask a running auto to stop, then clear the signal once it has:

```bash
$ mini stop
[ok] Stop signal created (.mini/STOP). The running auto will finish the current step and exit.

$ mini stop --clear
[ok] Stop signal cleared.
```

## Notes

- Stopping is **cooperative**, not a kill — the run stops at the next
  checkpoint, not mid-step. For a hard interruption, use Esc / Ctrl+C in the
  session itself.
- Remember to `--clear` the signal before starting the next autonomous run,
  otherwise it would stop again immediately.

## Related

- [`mini auto`](auto.md) / [`/mini:auto`](../interactive/auto.md) — the run this
  signal stops
