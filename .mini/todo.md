# Ideas & changes

> Archive of future ideas and changes for this project. Managed by `mini todo`
> (`add` / `done` / `remove`); `mini next` offers the open items as candidate
> phase ideas. You can also edit this checklist by hand.
- [ ] Decision records: consistency — mini doctor orphan-check (decision file with no matching phase, same pattern as stale run reports) and mini undo removes/restores the decision file.
- [x] Bump GitHub Actions to a Node 24-capable version. CI annotations warn that actions/checkout@v4 and actions/setup-node@v4 run on Node 20, which GitHub forces to Node 24 starting 2026-06-16 (removed 2026-09-16). Update .github/workflows/ci.yml to the current major (e.g. checkout@v5/setup-node@v5) so CI keeps running without the deprecation warning.
