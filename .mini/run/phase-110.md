---
phase: 110
verdict: done
steps:
  - title: "Drop silent status-line write in auto branch"
    status: done
  - title: "Print honest install summary + removal hint"
    status: done
  - title: "Update postinstall tests for opt-in status line"
    status: done
  - title: "Verify: typecheck, tests, simulated global install"
    status: done
---

# Phase 110 — report from the auto session

## What was done

The non-TTY global install (`npm i -g`) no longer silently edits the user's
`~/.claude/settings.json`. In `runPostinstall` (`src/install/postinstall.ts`):

- The `auto` (non-TTY global) branch now installs only the slash commands
  (additive, namespaced, easy to remove). `offerStatusline` is no longer called
  with a forced `confirm: () => true` in this path.
- After writing the commands, it prints an honest summary: that the status line
  is opt-in/not enabled and how to turn it on, plus a one-line full-removal hint
  (`npm uninstall -g mini-orchestrator` + delete the commands dir, taken from
  the resolved target's display path).
- The status line is still offered in the **interactive** postinstall path
  (a TTY is present, the user is asked first) — that behaviour is unchanged.
- Doc comments updated to state the status line stays opt-in on a global install.

## Tests

- `src/install/postinstall.test.ts`: the global-install test now asserts the
  commands are written **and** `~/.claude/settings.json` is absent (status line
  opt-in). The foreign-status-line test was renamed and still asserts an
  existing foreign `statusLine` is left intact.

## Verification (done mechanically, nothing left for a human)

- `npm run typecheck` — clean.
- `npm test` — 66 files, 833 tests pass.
- Simulated a non-TTY global install (`INIT_CWD`/`HOME` temp dirs,
  `npm_config_global=true`): 18 commands created under `~/.claude/commands/mini`,
  **no** `settings.json` created, summary + removal hint printed as expected.

## Notes / follow-ups (separate phases, as discussed)

- `mini uninstall` command for clean removal of `~/.claude/commands/mini` and the
  mini `statusLine` block.
- Unhide `install-commands` and document the `npx mini-orchestrator
  install-commands` trial path at the top of README.
