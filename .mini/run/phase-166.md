---
phase: 166
verdict: done
steps:
  - title: "Add adversarial-project CommandDef to COMMAND_DEFS"
    status: done
  - title: "Carry the independence warning in the body"
    status: done
  - title: "Add adversarial-project to the install-commands hint line"
    status: done
  - title: "Extend install-commands.test.ts for the new command"
    status: done
---

# Phase 166 — report from the auto session

## What was done
- Added a new `adversarial-project` entry to `COMMAND_DEFS` in `src/install/commands.ts`,
  placed right after `adversarial` for logical grouping. It carries:
  - `description: 'mini — independent red-team review of a range of phases'`,
  - `argumentHint: '[--from-phase N --to-phase M | --from <ref> --to <ref>]'`,
  - a custom `body` that runs `mini context adversarial-project $ARGUMENTS`, explains the
    two mutually exclusive range forms (phase numbers vs git refs), and tells Claude to
    relay the non-zero error and stop on an invalid range.
- The body reuses the same independence warning as `/mini:adversarial` (inline review shares
  the author's context → prefer `mini adversarial-project` in a terminal, or `/clear` first),
  so the slash command doesn't pretend to be independent when it isn't.
- Added `/mini:adversarial-project` to the post-install `log.hint(...)` list in
  `src/commands/install-commands.ts`, so the summary line matches the files actually written.
- Tests:
  - `install-commands.test.ts`: added `adversarial-project.md` to the expected file list
    (sorts before `adversarial.md` because `-` < `.`) and a new `it` asserting the file
    contains `mini context adversarial-project $ARGUMENTS`, an `argument-hint:` with both
    range forms, the independence note and `/clear`.
  - `install.test.ts`: the hard-coded command count was 21; bumped to 22 and added a
    `toContain('adversarial-project.md')` assertion. This second test was not in the plan but
    had to change — it counts the generated commands and would otherwise have failed.

## Verification
- `npm run typecheck` — clean.
- Full `vitest run` — 83 files, 1140 tests pass (initial run flagged the stale count in
  `install.test.ts`; fixed and re-run green).

## Notes / scope
- Docs (README, `mini --help` entry, `mini doctor` count, CHANGELOG) are deliberately **out
  of scope** here — they are backlog item [7], the final piece of the adversarial-project
  series. This phase is the generator + tests only.
- Unhappy path: the slash body delegates range validation to `mini context adversarial-project`
  (phase 165 already exits non-zero with a clear message on an invalid/mixed range); the body
  instructs Claude to relay that and stop rather than invent a range.

## For the human
Nothing UI-only to eyeball — the change is a generated markdown command and its tests, all
verified mechanically. If you want, run `mini install-commands` (or `/mini:init` flow) in a
scratch dir to see `adversarial-project.md` appear, but the tests already cover its contents.
