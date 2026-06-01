---
phase: 95
verdict: done
steps:
  - title: "Version-check + cache module"
    status: done
  - title: "Statusline upgrade indicator"
    status: done
  - title: "mini upgrade command"
    status: done
  - title: "/mini:upgrade slash command"
    status: done
  - title: "README and CHANGELOG"
    status: done
verify:
  - title: "Status-line upgrade indicator appearance"
    detail: "Rendered mechanically (yellow `↑ 1.9.1` appended after the gauge, omitted when up to date — verified via `mini statusline` with a crafted cache). A human eye should confirm the placement/color reads well in a real Claude Code session."
  - title: "`mini upgrade` CLI flow and wording"
    detail: "`mini upgrade --check` was run for real (current 1.9.0 == latest on npm → 'up to date'). The available/confirm/install path and the dev-install warning were not exercised live (no newer version published yet); a human may want to judge the wording/flow."
---

# Phase 95 — report from the auto session

Added `mini upgrade` (+ hidden `mini check-version`), the `/mini:upgrade` slash
command, and a non-blocking status-line "new version available" indicator.

## What was done
- **`src/upgrade/versionCheck.ts`** — npm-registry fetch via built-in `fetch`, a
  TTL cache (5h) in the OS temp dir, semver `isNewer`, pure
  `upgradeStatusFromCache`, and `refreshCache()`. New `compareSemver` added to
  `version.ts` (numeric `x.y.z`, so `1.10.0 > 1.9.0`).
- **Status line** — `StatuslineData.upgrade` + a yellow `↑ <latest>` render
  segment (omitted when current). The `statusline` command reads the cache only
  and spawns a detached, `unref`-ed `mini check-version` when the cache is stale
  (>5h), so it never blocks on the network.
- **`src/commands/upgrade.ts`** — fresh blocking check, reports current → latest,
  installs via `npm install -g mini-orchestrator@latest`; `--check` (report only)
  and `--yes` (skip confirm). Pure `decideUpgrade` and `classifyInstall` (npm vs
  the `install-local`/source dev layout) are unit-tested; a dev build is detected
  and skipped with a hint.
- **`/mini:upgrade`** added to `COMMAND_DEFS` (non-interactive: `--check` → confirm
  in chat → `--yes`); install hint + the `13 → 14` command-count tests updated.
- **README + CHANGELOG** documented the command, slash command and indicator.

## Verification done mechanically
- Full suite green: 764 tests. `typecheck` clean. `build` ok. `mini map` regen.
- `mini upgrade --check` hits the real registry and reports correctly.
- `mini statusline` with a crafted cache shows `↑ 9.9.9` (newer) and omits it
  when the cache equals the current version.
- `mini check-version` writes the cache; `upgrade` is in `--help`, `check-version`
  is hidden.

## Notes / open questions
- The live "install" path and the dev-install warning could only be reasoned
  about, not run end to end, because the published version currently equals the
  local one (nothing newer to install). The decision logic is covered by tests.

## Verify outcome
- Human review in the chat: both items approved — the `↑ <version>` indicator
  (yellow, trailing) and the `mini upgrade` flow/wording are fine. No changes
  requested.
