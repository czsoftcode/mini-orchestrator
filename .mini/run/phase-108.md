---
phase: 108
verdict: done
steps:
  - title: "Extract shared save + add applyImport"
    status: done
  - title: "Wire CLI --prompt / --apply / --force"
    status: done
  - title: "Add the /mini:import-gsd slash command"
    status: done
  - title: "README + applyImport tests"
    status: done
---

# Phase 108 — report from the auto session

Added a `/mini:import-gsd` slash command following the proper mini pattern (the
user picked this over a thin nested-Claude wrapper): the in-session Claude does
the reading/extraction, and mini handles only the parse + save.

## What was done

- **`commands/import-gsd.ts`** — factored the project.md/state build + save into
  shared helpers (`buildImportProjectMd`, `buildImportState`, `saveImport`) and
  added `applyImport(text, { cwd, force })`: it refuses an existing project
  without `--force` (preserving its model config on overwrite), parses the
  `NAME/WHAT/…/PHASES` contract preserving phase statuses, and saves. The bare
  interactive `importGsd()` now reuses `saveImport`.
- **`cli.ts`** — the `import-gsd` command gained `--prompt` (print
  `buildImportGsdPrompt()` to stdout; no Claude, no project needed), `--apply`
  (read stdin → `applyImport`) and `--force`. Bare `mini import-gsd` keeps the
  interactive terminal flow.
- **`install/commands.ts`** — added the `import-gsd` slash command (custom body:
  check `.planning/`, confirm overwrite, `mini import-gsd --prompt`, read
  `.planning/` in-session, pipe the contract into `mini import-gsd --apply`). 18
  generated slash commands now.
- **Tests** — new `import-gsd.test.ts` (5 cases: parse+save with statuses,
  current-phase pointer to first doing then first proposed, refuse-without-force,
  force+preserve-models, reject-unreadable). Updated the slash-command-count
  assertions (`install.test.ts`, `install-commands.test.ts`) from 17 to 18.
- **README + CHANGELOG** — documented the slash command and the new flags.

## Verification done by me (mechanical)

- `tsc --noEmit` clean; `npm run build` succeeds.
- Full test suite: **833 passed (66 files)**.
- End-to-end against the built `dist`: `mini import-gsd --prompt` prints the
  extraction prompt; piping a `NAME/…/PHASES` contract into
  `mini import-gsd --apply` in a temp dir saved 2 phases (`done,doing`,
  `currentPhaseId=2`), confirmed via `mini status --json`.

## Notes for the human

- The slash-command **dialog** itself (how the `/mini:import-gsd` flow reads
  `.planning/` and confirms overwrite in a live Claude Code session) was not
  exercised against a real GSD project — worth a try on an actual `.planning/`
  directory if one is handy. The underlying `--prompt`/`--apply` mechanics are
  covered above.
