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
