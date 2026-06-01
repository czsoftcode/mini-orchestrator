# Phase 95 — mini upgrade a /mini:upgrade

**Goal:** Add a `mini upgrade` terminal command and a `/mini:upgrade` slash command that install the latest mini-orchestrator from npm, plus a non-blocking statusline indicator that shows when a newer version is available on npmjs.com (version cached locally with a TTL, so the status line never blocks on the network).

## Steps
- [done] Version-check + cache module
- [done] Statusline upgrade indicator
- [done] mini upgrade command
- [done] /mini:upgrade slash command
- [done] README and CHANGELOG

## Auto-commit
- Phase 95: mini upgrade a /mini:upgrade

## Discussion
# Phase 95 — mini upgrade a /mini:upgrade

## Intent
Make it easy to keep the globally installed `mini-orchestrator` up to date.
Three deliverables:
- a `mini upgrade` terminal command that installs the latest version from npm,
- a `/mini:upgrade` slash command (non-interactive wrapper for use inside Claude
  Code — preview, confirm in chat, apply),
- a non-blocking statusline indicator that signals when a newer version is
  available on npmjs.com.

## Key decisions
- **Upgrade mechanism = npm only.** `mini upgrade` runs
  `npm install -g mini-orchestrator@latest`. This covers the documented install
  path (including the `~/.local` npm prefix without sudo). It does NOT try to
  detect/handle a dev `install-local` (symlink) setup — for that case it just
  prints a hint that the dev build should be updated via `npm run install-local`.
- **Latest-version source = npm registry.** Read the latest published version
  from the npm registry (e.g. `https://registry.npmjs.org/mini-orchestrator/latest`
  or the dist-tags endpoint). No extra runtime dependency — use Node's built-in
  `fetch`.
- **Statusline indicator = `↑ <latest>` at the end, in yellow, only when an
  upgrade is available.** Appended as a new last segment, e.g.
  `dir · model · 1M ▰▱… 12% · ↑ 1.9.1`. When the cache says we are current (or
  there is no cache yet), nothing extra is shown.
- **Cache + refresh strategy (statusline never blocks on the network):**
  - The statusline only *reads* a small cache file (latest known version +
    timestamp), stored under the OS cache/temp dir, keyed to the package name.
  - When the cache is missing or older than the TTL (**5 hours**), the statusline
    fires a detached, fire-and-forget background fetch to refresh the cache and
    returns immediately — it never awaits the network.
  - `mini upgrade` performs a fresh synchronous check of the latest version (and
    updates the cache) before deciding whether to install.

## Watch out for
- The statusline must never throw or block — wrap all cache/network work so a
  failure prints nothing extra (the existing statusline already swallows errors).
- Compare versions with proper semver ordering (reuse/extend `version.ts`
  helpers), not string comparison, so e.g. `1.10.0 > 1.9.0`.
- The background fetch must be truly detached (`spawn` with `detached` +
  `unref`, stdio ignored) so Claude Code's statusline call returns instantly.
- Keep the statusline module lean — it deliberately imports only Node builtins
  and the statusline module; the version-check/cache logic should stay
  dependency-light and not pull in heavy CLI/graph code.
- `mini upgrade` should be a no-op-with-message when already on the latest
  version, and should clearly report current → latest before installing.
- Handle offline / registry errors gracefully (clear message for `mini upgrade`,
  silent for the statusline).

## Run report
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
