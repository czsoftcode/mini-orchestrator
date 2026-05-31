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
