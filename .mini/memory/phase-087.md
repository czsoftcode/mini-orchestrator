# Phase 87 — mini statusline auto-install

**Goal:** Add a statusline renderer (mini statusline) that reads the Claude Code JSON from stdin and prints a shortened project directory name + model + context-window usage in percent, and register it into ~/.claude/settings.json during postinstall only when the user has no statusLine configured yet (never overwrite an existing one, idempotent).

## Steps
- [done] Statusline core: JSON + transcript usage
- [done] Render the statusline line
- [done] mini statusline command in CLI
- [done] Merge statusLine into settings.json
- [done] Postinstall asks and installs statusline
- [done] Docs: enabling and disabling the statusline

## Auto-commit
- Phase 87: mini statusline auto-install

## Discussion
# Phase 87 — mini statusline auto-install

## Intent
Ship a mini-branded Claude Code statusline that users get "for free" after
installing mini — like Claude's own statusline and GSD's. Two parts:

1. **Renderer**: a new `mini statusline` subcommand. Claude Code invokes it via
   `settings.json` → `statusLine: { type: "command", command: "<mini statusline>" }`,
   passing the status JSON on **stdin**. The command parses it and prints one
   line: shortened project directory + full model name (with version) + context
   window size + a graphical bar + numeric percentage of context-window usage.
2. **Auto-install**: the npm `postinstall` (the same hook that installs the
   slash commands, Phase 86) registers this statusline into the user's
   `~/.claude/settings.json` — but ONLY when the user has no `statusLine` yet,
   and only after asking (TTY).

Motivation: the context-window % must be computed from the transcript (Claude
Code does NOT pass token usage in the status JSON); the user's own
`~/.claude/statusline-command.sh` already proves the exact logic and is the
reference implementation to port to TS.

## Key decisions
- **Renderer = Node `mini statusline` subcommand** (not a shipped shell script).
  Cross-platform (Windows too), unit-testable, no bash/python3 dependency.
  Registered in settings as a `command` statusLine.
- **Content (confirmed with user):** `<dir> · <model> · <window> <bar> <pct>%`
  - `dir`: **basename** of the project/current dir, truncated (≈24 chars + `…`)
    so a long path never blows up the line.
  - `model`: **full `display_name` including the version number** (e.g.
    `Opus 4.8`), taken from `model.display_name`.
  - `window`: the context-window **size label** `1M` or `200k`.
  - usage: **both** a graphical indicator (a small bar, e.g. ~8–10 cells) **and**
    the numeric **percent**. (Showing `used k/limit k` too is a nice-to-have.)
  - No `user@host`, no git branch (kept simpler than the user's PS1 statusline).
- **Token usage logic — port from the user's `statusline-command.sh`:**
  - usage = last transcript `message.usage` entry, summing
    `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`.
  - window limit: **1M** for Sonnet 4.x and Opus ≥ 4.7, otherwise **200k**;
    parse the version out of `display_name`.
  - **auto-escalate** the limit to 1M if `used > limit` and `limit < 1M`.
  - JSON fields: `cwd` (fallback `workspace.current_dir`), `model.display_name`,
    `transcript_path`.
- **Auto-install behavior (confirmed):** in postinstall, if `~/.claude/settings.json`
  has **no** `statusLine`, and a TTY is present, **ask y/n** before adding it.
  Without a TTY: skip silently (consistent with Phase 86). If a `statusLine`
  already exists (Claude's, GSD's, the user's), **never touch it**.
- **Settings target = user-level `~/.claude/settings.json`** (via `os.homedir()`,
  already used in `install.ts`). Read-modify-write that **preserves all other
  keys** and 2-space indentation; create the file if missing.
- **Idempotent for our own entry:** recognize mini's own statusLine (command
  string references `mini statusline` / the mini bin) and don't duplicate it on
  repeated installs.

## Watch out for
- **Command string robustness:** `command: "mini statusline"` only works if
  `mini` is on PATH (global install). Decide at plan time whether to write the
  **absolute path to the installed mini bin** (resolvable at install time) or
  `npx mini statusline`, so a local-only install still works. `detectClaude.ts`
  already distinguishes global vs local.
- **Node startup latency:** the statusline runs on every refresh — keep the
  `mini statusline` entry **lean** (avoid importing the whole CLI/graph deps;
  ideally a small dedicated module). Parse the transcript without loading it all
  into memory if easy, but a simple line scan (as in the user's script) is fine.
- **Keep render pure & testable:** separate (a) JSON-in → line-out render, (b)
  transcript usage extraction, (c) settings.json merge — each a pure function
  over inputs so vitest can cover them. Reuse existing `src/ui/log.ts` /
  `src/ui/ask.ts` for the y/n prompt; do NOT block the install on errors
  (downgrade to a warning like the current postinstall).
- **`src/tokens/measure.ts` is NOT reusable here** — it estimates prompt cost
  offline (length/4); live context usage comes from the transcript instead.
- **Model→window mapping goes stale** as new models ship. Centralize and comment
  it; the `used > limit` auto-escalation is the safety net.
- **Disable/uninstall path:** the user just had to remove a statusLine by hand.
  Out of scope for this phase, but: never remove a foreign statusLine; consider
  documenting how to disable, or a future `mini statusline --uninstall` that only
  removes mini's own entry.
- **CLI registration touch points** (mirror Phase 86): register the command in
  `cli.ts`, add `--help` text, and reconcile with the postinstall flow in
  `src/install/postinstall.ts` / `install.ts` so the settings write shares one
  code path.

## Run report
---
phase: 87
verdict: done
steps:
  - title: "Statusline core: JSON + transcript usage"
    status: done
  - title: "Render the statusline line"
    status: done
  - title: "mini statusline command in CLI"
    status: done
  - title: "Merge statusLine into settings.json"
    status: done
  - title: "Postinstall asks and installs statusline"
    status: done
  - title: "Docs: enabling and disabling the statusline"
    status: done
verify:
  - title: "Status line looks right inside a live Claude Code session"
    detail: "Verified mechanically via piped JSON (correct line, bar, %, window label, dir truncation) and the built CLI. What I can't check from here is how it renders in the real Claude Code footer (spacing, the ▰/▱ glyphs in the user's terminal/font, overall legibility). Quick check: run a real npm install (or add the statusLine block) and look at the bottom bar."
---

# Phase 87 — report from the auto session

All six steps are done; the full suite passes (706 tests, 57 files) and
`tsc --noEmit` + `npm run build` are clean.

## What was built
- **`src/statusline/`** — pure, testable core:
  - `statusline.ts`: parses the status JSON, extracts context usage from the
    transcript JSONL (last `message.usage`, summing `input_tokens +
    cache_read_input_tokens + cache_creation_input_tokens`), maps model→window
    (1M for Sonnet 4.x / Opus ≥4.7, else 200k) with auto-escalation when usage
    runs past the base limit.
  - `render.ts`: builds the line `<dir> · <model> · <window> <bar> <pct>%`
    (basename truncated to ~24 chars, 10-cell ▰/▱ gauge, numeric percent).
- **`src/commands/statusline.ts` + `cli.ts`** — the lean `mini statusline`
  command: reads stdin, reads the transcript file, prints the line. Imports only
  the statusline module + Node builtins (no heavy deps), and never throws.
- **`src/install/statuslineSettings.ts`** — pure `mergeStatusline` + IO
  `installStatusline`: adds a `statusLine` to `~/.claude/settings.json` only when
  none exists, preserves other keys + 2-space indent + trailing newline, creates
  the file if missing, recovers from a malformed file.
- **`src/install/install.ts` `offerStatusline` + postinstall wiring** — with a
  TTY and no existing statusLine, asks y/n then installs; without a TTY skips
  silently; errors are downgraded to a warning so `npm install` never fails.
- **README** — new "Status line" section (what it shows, how it's offered on
  install, how to disable) + a command-table row.

## Key decisions / notes
- **Command string:** I went with an absolute `node "<…>/dist/cli.js"
  statusline` resolved from the module location at install time. It works for
  both global and project-local installs (does not rely on `mini` being on
  PATH). Verified the built path resolves correctly.
- **"Never overwrite foreign" + idempotent** are handled by one simple rule:
  write only when there is **no** statusLine at all. If any statusLine exists
  (mini's own from a previous run, or a foreign one) we leave it — so no
  duplication and no clobbering. `offerStatusline` also dry-runs first so it
  doesn't even prompt when a statusLine already exists.
- `src/tokens/measure.ts` was confirmed unrelated (offline prompt-cost estimate);
  live usage comes from the transcript.

## Tests added
`src/statusline/statusline.test.ts`, `src/statusline/render.test.ts`,
`src/install/statuslineSettings.test.ts`, `src/install/statuslineOffer.test.ts`
(+ the existing non-interactive postinstall tests still pass unchanged).

## Out of scope (noted in discussion)
No `mini statusline --uninstall`; disabling is documented as removing the
`statusLine` block. No ANSI colors yet (kept monochrome for easy snapshotting and
universal terminal legibility) — could be layered on later.

## Verify findings
2026-05-31 — UI/UX review with the human (statusLine temporarily wired into
`~/.claude/settings.json` → `node "…/dist/cli.js" statusline`, the live footer
inspected).

**OK**
- The line renders in the real Claude Code footer; the `·` separator and the
  ▰/▱ gauge glyphs display correctly and are legible in the user's terminal.
- Format, dir truncation, model+version, window label and percent all look right
  across the sampled models / usages.

**To fix (→ back to `/mini:do`)**
- **Add color to the status line** (the only request; the human left the exact
  scheme to me). Proposed scheme:
  - directory → **bold cyan**,
  - model → terminal default (leave uncolored to avoid over-coloring),
  - window label + bar + percent → **threshold color by fill**: green < 60 %,
    yellow 60–85 %, red > 85 % (so the gauge doubles as a warning signal),
  - the `·` separators → **dim**.
  - **Implementation caveat:** the statusline stdout is piped (NOT a TTY), so
    `picocolors` would auto-strip the colors — emit **raw ANSI escape codes**
    (like the reference bash script) or force-enable colors. Keep `render`
    pure/testable: add a `color` option (default on); the existing plain-string
    tests run with `color: false`, plus a test asserting the escape codes and
    the threshold boundaries.

**Resolved (2026-05-31)** — color added in `render.ts` exactly as proposed: raw
ANSI codes (no picocolors, so they survive the piped stdout), `color` option
default-on, dir = bold cyan, model uncolored, gauge threshold-colored
(green/yellow/red via the exported `usageColor`), dim `·` separators. Tests:
existing plain-string assertions moved to `{ color: false }`, plus a color test
and a `usageColor` boundary test. Full suite green (708), typecheck + build
clean; the rebuilt `dist/cli.js` now shows colors in the live footer.
