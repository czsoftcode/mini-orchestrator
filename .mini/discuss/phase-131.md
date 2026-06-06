# Phase 131 — Problem-first README intro + badges

## Intent
Rework the **top region** of `README.md` so a first-time visitor is sold on the
*problem* before the *mechanics*. Source proposals: `~/Documents/draft_readme.md`
and `~/Documents/mini-feedback.md`. Today the README opens with `# mini`, a terse
technical description, and (paragraph 3) the GSD comparison used as the product
*definition* — which references a tool nobody knows. We replace that with a
hook → problem (both agent failure modes) → solution rhythm → demo → quick start
ordering, add badges, and demote the GSD comparison.

Scope is the intro/quick-start/installation region. Deferred to backlog (already
added to `mini todo`): "mini vs. native plan mode" section, "your first phase"
walkthrough, moving Sponsors lower, GitHub repo topics, and re-recording the GIF.

## Key decisions
- **H1 = `# mini-orchestrator`** (matches npm package + website, fixes the name
  fragmentation from feedback). The CLI command stays `mini` — say so explicitly
  in the text so the rename doesn't confuse.
- **Badges: npm version, node version, license only.** Deliberately NOT downloads
  (~0 installs looks dead) and NOT CI/build (Actions are disabled via billing; the
  CI badge stays commented out at the top — do not re-enable it).
- **Restructure to the draft's order**, do not just prepend: intro (hook + both
  failure modes + propose→plan→implement→verify) → "See it in action" (demo) →
  Quick start → Installation. Merge the two existing Quick start sections into one.
- **Primary path = slash commands inside Claude Code** (`/mini:init` → `/mini:next`
  → `/mini:plan` → `/mini:do` → `/mini:done`). The CLI flow (`mini init/next/...`)
  stays as the secondary/alternative path lower down. `/mini:init` really exists
  (install-commands generates it; global `-g` install auto-writes the commands),
  so the example is truthful.
- **Reuse the existing GIF `demo/cycle.gif`** (raw githubusercontent URL, lines
  72–78) for "See it in action" — it is NOT a placeholder. The GIF currently shows
  the CLI cycle; re-recording it for the slash flow is a separate backlog item.
- **Consolidate the three install passages**: bring `npm install -g
  mini-orchestrator@latest` up into the quick start; demote the npx "try it
  without touching ~/.claude", the no-sudo prefix tip, and the "from git / for
  development" block into a details/lower Installation area.
- **Benefit reframing only in the intro** (from "token efficiency / money" toward
  "won't go off the rails / stay at the helm / won't exhaust your limit"). Leave
  the body "What gets sent to Claude" (~600-1000 tokens) section as is.

## Watch out for
- **GIF↔text mismatch**: the primary path is now slash commands but the GIF shows
  the CLI cycle. Acceptable for this phase (re-record is a todo), but add a short
  caption noting the GIF shows the equivalent CLI cycle, so it doesn't read as a bug.
- **Internal anchors / links**: reordering top sections must not break in-page
  links like `#status-line`, `#auto-mode`, `#machine-readable-project-map-graph`,
  `#autonomous-miniauto` (those targets live lower and stay). After editing, grep
  for `](#` and verify every anchor still resolves to a heading.
- **No duplicate install instructions / no two "Quick start" headings** after the
  merge — that is the whole point of choosing restructure over prepend.
- **Do not re-enable the CI badge** (billing issue; Actions can't run).
- **English only** (project rule) — all README prose, including the new intro.
- Keep it honest: the draft's quick start omits `discuss`; that's fine as a
  simplified teaser, but every shown command must exist and behave as written.
