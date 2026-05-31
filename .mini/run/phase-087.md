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
