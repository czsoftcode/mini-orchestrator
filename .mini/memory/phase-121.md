# Phase 121 — Flag completion in mini completion

**Goal:** Extend the bash/zsh completion scripts so that, after a command name, they also complete that command's option flags (e.g. 'mini done --' offers --bump/--push/--apply); the per-command flag map is derived from commander so it stays in sync. Verifiable via snapshot tests of the generated scripts.

## Steps
- [done] Renderer carries per-command flags
- [done] CLI derives flags from commander
- [done] Update tests, snapshots, docs

## Auto-commit
- Phase 121: Flag completion in mini completion

## Run report
---
phase: 121
verdict: done
steps:
  - title: "Renderer carries per-command flags"
    status: done
  - title: "CLI derives flags from commander"
    status: done
  - title: "Update tests, snapshots, docs"
    status: done
---

# Phase 121 — report from the auto session

Extended `mini completion` so the generated bash/zsh scripts now complete each
command's option flags, not just the command names.

## What was done
- **`src/completion/render.ts`** — `CompletionSpec.commands` is now a structured
  `CommandSpec[]` (`{ name, flags }`). Both renderers gained a flag branch: when
  the current word starts with `-`, they complete the flags of the command in
  position 1 (bash via a `case "${COMP_WORDS[1]}"`, zsh via `case ${words[2]}`),
  otherwise commands (first word) / files as before. A `case` branch is emitted
  only for commands that actually have flags. Renderers stay pure.
- **`src/cli.ts`** — the completion action now builds `{ name, flags }` per
  command, deriving flags from `c.options` (short + long), still skipping hidden
  helpers and adding a flagless `help`.
- **`src/commands/completion.ts`** — signature takes `CommandSpec[]`.
- **Tests** — `render.test.ts` and `completion.test.ts` updated to the new shape
  with flag-completion cases and refreshed inline snapshots; flagless commands
  verified to emit no `case` branch.
- **Docs** — `docs/non-interactive/completion.md` and the README row now mention
  flag completion and its one limitation (no flag-*value* completion).

## Verification (all mechanical, done here)
- `npm run typecheck` clean; full suite green (869 tests).
- Generated and sourced the real bash script (`bash -n` clean), then exercised
  completion: `mini done --` → `--apply --accept-verify --bump --push`,
  `mini done --p` → `--push`, `mini status --` → `--json`. Command-name and file
  fallback still work.

## Notes / limitations
- Only flag *names* are completed, not their *values* (e.g. the level after
  `--bump`) — documented as a known limitation; would need per-flag value tables.
- zsh was again only snapshot/structure-tested (`zsh` not installed here); the
  script follows the standard `#compdef` + `compdef` pattern and mirrors the
  verified bash logic.
