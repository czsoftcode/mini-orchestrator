---
phase: 112
verdict: done
steps:
  - title: "Unhide install-commands in CLI"
    status: done
  - title: "README: npx zero-touch trial"
    status: done
  - title: "docs pages: uninstall + install-commands"
    status: done
  - title: "docs index rows"
    status: done
  - title: "Verify: typecheck, tests, --help"
    status: done
---

# Phase 112 — report from the auto session

## What was done

Made the non-invasive evaluation path discoverable and documented it.

- **`src/cli.ts`**: dropped `{ hidden: true }` from the `install-commands`
  command so it now appears in `mini --help`; flags/behavior unchanged. Refreshed
  its comment to call out the `npx` trial entry point.
- **`README.md`**: new top-level section **"Try it without touching
  `~/.claude`"** documenting `npx mini-orchestrator install-commands` (one-off via
  npx, asks project vs user scope, never edits `settings.json`), with a pointer to
  `mini uninstall`. Also **corrected** the Installation paragraph, which still
  described the old behavior (status line wired automatically) — it now states the
  status line is opt-in and links `mini uninstall` for full cleanup.
- **`docs/non-interactive/install-commands.md`** and
  **`docs/non-interactive/uninstall.md`**: new reference pages following the
  existing convention (synopsis, description, options table, examples with sample
  output, notes, related links). Both marked console-only (no slash sibling).
- **`docs/README.md`**: new "Install & cleanup" table listing both commands
  (em dash in the interactive column) and updated the console-only note to cover
  `stop`, `install-commands`, and `uninstall`.

## Verification (all mechanical)

- `npm run typecheck` — clean.
- `npm test` — 67 files, 849 tests pass (no code logic changed; docs + unhide).
- `mini --help` (via `tsx`) now lists both `install-commands` and `uninstall`.
- Confirmed the doc files referenced from README / index exist on disk.

## Notes

- This completes the original three-part split (phases 110–112) making first-run
  non-invasive for evaluators: status line opt-in (110), `mini uninstall` for
  clean removal (111), and the discoverable npx trial + docs (112).
- No behavior changes in this phase — purely discoverability and documentation.
