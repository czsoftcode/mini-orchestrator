# FAQ

Common questions about how mini behaves. The README keeps only a few new-user
questions inline; the full list — including the version-bump, undo and memory
internals — lives here.

**Why does Claude Code ask for permission every time?**
In `mini do` the classic permission mode is the default (you click on every Edit/Bash). In `mini auto`, `acceptEdits` is used — Edit/Write no longer ask, but Bash still does (no random `rm -rf`).

**What if I want to do a phase, but not the way Claude proposed it?**
`mini next` → "Edit and add" → you edit the title and goal by hand. Or you add it to `state.json` by hand.

**What if a phase is "done" but has todo steps?**
`mini done` → "Mark the phase as done" → the remaining steps are marked `skipped` and it moves to the next phase.

**Can I pause and come back tomorrow?**
Yes. The state is in `.mini/state.json`, you can commit it to git or put it on the cloud. `mini status` tells you where you left off.

**Commit and push after a phase?**
When `mini done` (or `mini auto`) finalizes a phase as `done`, it automatically runs `git add -A && git commit` with the message `Phase {id}: {title}` (optionally with a body from the note). If the cwd is not a git repo, there is nothing to commit, or the commit fails (e.g. a pre-commit hook), it continues and you finish the commit by hand. The push is never done automatically — after the commit you'll see a `git push` hint that you run yourself.

**Version bump, CHANGELOG and tag?**
By default `done` does **not** bump the version (`--bump none`). With `--bump patch|minor|major` it raises it before the commit and, for `minor`/`major`, folds the `## [Unreleased]` section in `CHANGELOG.md` into a dated version (patches accumulate). The version is written to **the place that matches the project's language**, with sources tried in a fixed priority (the first one carrying a version wins): `package.json` → `Cargo.toml` (`[package]`) → `pyproject.toml` (`[project]`/`[tool.poetry]`) → `setup.py` → `composer.json` (only when a `version` field is already present) → `__version__ = "x.y.z"` → a language-agnostic `VERSION` file. When no manifest carries a version, `VERSION` is used and, if missing, created with `0.1.0`. `--push` additionally pushes after the commit and creates a git tag `v<version>` (read from the same source) — that's why `--push` requires an explicit `--bump` (without it the tag would have no new version). Everything is opt-in: without flags, done just commits the phase work.

**Memory record after a phase?**
After finalizing a phase as `done` (and after the auto-commit), `.mini/memory/phase-{id}.md` is written with a summary of **what was done / key decisions / loose ends**, and its short summary for the `next` prompt goes into `last-memory.md`. By default memory is assembled directly in `mini` without calling Claude (free and instant); a Claude print-mode session is used only when the `memory` scope is explicitly set. Memory is nice-to-have — when the write fails, a warning is printed and the workflow continues. When you turn on the `memory` scope, we recommend a cheaper model (`mini model memory haiku`), because it runs after every finished phase.

**Undo after the auto-commit?**
`mini undo` remembers the pre-commit HEAD of the last auto-committed phase (in `state.json` at `phase.autoCommit`). When you call `mini undo` after `mini done`, it offers — alongside reverting state.json — a `git reset --soft` back to the previous commit, but only if HEAD still sits on the auto-commit and the working tree is clean. If you committed something else in the meantime or have uncommitted changes, undo reverts only `state.json` and prints a hint on how to drop the commit by hand.

**Does it work with an API key instead of Pro/Max?**
Yes, `mini` just runs `claude` as a subprocess — authentication is handled by Claude Code itself, based on how it's configured.

## Workflow tips

- Start with `mini auto` for the first 1-2 phases to see how it suits you
- Then switch between `mini auto` (fast) and the classic `mini do` (control)
- If Claude proposes nonsense in `mini next` in auto, **press Ctrl+C** and run without auto
- After every phase, `mini status` shows the overall progress
