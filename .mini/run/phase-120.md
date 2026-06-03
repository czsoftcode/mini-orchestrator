---
phase: 120
verdict: done
steps:
  - title: "Completion script renderer"
    status: done
  - title: "completion command + CLI wiring"
    status: done
  - title: "Tests, docs, wrap-up"
    status: done
---

# Phase 120 — report from the auto session

Added a `mini completion <bash|zsh>` subcommand that prints a shell completion
script for the CLI.

## What was done
- **`src/completion/render.ts`** — pure, snapshot-friendly renderers. `SHELLS`,
  `isShell` guard, and `renderCompletion(shell, { binName, commands })` that
  emits a self-contained bash script (no `bash-completion` dependency) and a
  zsh script (`#compdef` + `compdef` registration). The first word completes
  command names; further arguments fall back to file completion.
- **`src/commands/completion.ts`** — validates the shell (unknown → error + exit
  1) and writes the script to stdout.
- **`src/cli.ts`** — `program.command('completion <shell>')`, deriving the
  command list from `program.commands` at runtime (skipping hidden helpers like
  `check-version`, adding the implicit `help`) so the completion never drifts
  from the real command set.
- **Docs** — `docs/non-interactive/completion.md`, a row in `docs/README.md`
  (console-only section) and a row + cross-link in the main `README.md`.

## Verification (all mechanical, done here)
- `npm run typecheck` clean, full suite green (866 tests, incl. the new
  `render.test.ts` snapshots and `completion.test.ts`).
- Ran the command for real: `mini completion bash` / `zsh` produce the expected
  scripts, an unknown shell (`fish`) prints the error and exits 1.
- `bash -n` syntax-checked the generated bash script, then sourced it and
  confirmed completion works (`mini ver<Tab>` → `verify`).

## Notes / limitations
- Only top-level command names are completed, not per-command flags — that was
  the phase goal and keeps the script trivial and drift-free. Flag completion
  could be a later phase.
- The zsh script was only snapshot/structure-tested: `zsh` is not installed in
  this environment, so `zsh -n` could not run. The structure follows the
  standard `#compdef` + `compdef` pattern.
