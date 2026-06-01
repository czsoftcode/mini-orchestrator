# Phase 94 — Slash commandy /mini:undo a /mini:model

**Goal:** Add non-interactive native slash commands /mini:undo and /mini:model. For undo, add a non-interactive CLI path (--dry-run to preview the change, --yes to skip the confirmation prompt) so the slash command can show a preview, confirm in the chat and apply without a TTY prompt; for model, rely on the existing non-interactive subcommands (show / <scope> <id> / reset). Register both in COMMAND_DEFS and the install hint, update README/CHANGELOG, add tests.

## Steps
- [done] undo --dry-run a --yes flagy
- [done] /mini:undo slash command
- [done] /mini:model slash command
- [done] Update install hint and command tests
- [done] README and CHANGELOG

## Auto-commit
- Phase 94: Slash commandy /mini:undo a /mini:model

## Run report
---
phase: 94
verdict: done
steps:
  - title: "undo --dry-run a --yes flagy"
    status: done
  - title: "/mini:undo slash command"
    status: done
  - title: "/mini:model slash command"
    status: done
  - title: "Update install hint and command tests"
    status: done
  - title: "README and CHANGELOG"
    status: done
verify:
  - title: "Run /mini:undo and /mini:model in a real Claude Code session"
    detail: "Mechanically verified: the generated .md bodies, the new undo --dry-run/--yes CLI flags, and the full test suite (733 passing). What a human may want to confirm by hand is the end-to-end UX of the two new slash commands inside an actual Claude Code session — that /mini:undo shows the preview, waits for a chat confirmation and only then applies, and that /mini:model never triggers the interactive picker for empty/scope-only arguments."
---

# Phase 94 — report from the auto session

Added non-interactive native slash commands `/mini:undo` and `/mini:model`, the
counterparts of the interactive terminal commands `mini undo` / `mini model`,
which would otherwise block on a TTY prompt in the Claude Code Bash.

## What was done

1. **`undo` CLI made scriptable.** `undo()` now takes `{ dryRun, yes }`.
   `--dry-run` prints the same change summary as the interactive prompt (phase/step
   status changes + whether an auto-commit would be soft-reset) and exits without
   prompting or touching anything; `--yes` skips the `Proceed?` confirmation and
   applies directly. Both flags wired in `cli.ts`. Two new tests in `undo.test.ts`
   cover the preview (state untouched, no `ask`, no soft reset) and the apply
   (state reverted, no `ask`, soft reset runs).
2. **Two new `CommandDef`s** in `src/install/commands.ts`:
   - `undo` — custom body: `mini undo --dry-run` → relay preview → confirm in chat
     (destructive, only one step back) → `mini undo --yes`; never run a bare
     `mini undo`.
   - `model` — `argument-hint` + custom body using only the non-interactive forms
     (`mini model show` / `<scope> <model>` / `reset`), with `$ARGUMENTS`
     pass-through; for empty/scope-only args it shows the current state and asks in
     the chat rather than opening the picker.
3. **Install hint** in `install-commands.ts` extended with `/mini:undo`, `/mini:model`.
4. **Tests** updated for the new count (11 → 13 commands) in `install-commands.test.ts`,
   `install.test.ts`, `update.test.ts`, plus body assertions for `undo.md` /
   `model.md` (no `mini context`, the expected sub-commands present).
5. **README + CHANGELOG** document both slash commands and the new undo flags.

The project command files `.claude/commands/mini/{undo,model}.md` were regenerated
via `install-commands --project`.

## Checks

- `npm run typecheck` — clean.
- `npm run build` — clean (dist regenerated; the new install hint is in the build).
- `npm test` — 733 passing, 59 files.

## Notes / open questions

- Nothing blocked. The `verify` item above is the only thing left for a human eye
  (the live slash-command UX); everything else was verified mechanically.
