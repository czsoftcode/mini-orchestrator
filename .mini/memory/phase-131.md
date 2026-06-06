# Phase 131 — Problem-first README intro + badges

**Goal:** Replace the top of README.md with a problem-first intro (hook, both agent failure modes, the propose->plan->implement->verify rhythm, quick start) and add npm version/node/license badges, moving the GSD comparison out of the product definition; verify the /mini:* example commands match reality.

## Steps
- [done] Intro block: H1 + badges + hook
- [done] See it in action + merged Quick start
- [done] Consolidate installation passages
- [done] Demote GSD comparison out of the intro
- [done] Verify anchors and command honesty

## Auto-commit
- Phase 131: Problem-first README intro + badges

## Discussion
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

## Run report
---
phase: 131
verdict: done
steps:
  - title: "Intro block: H1 + badges + hook"
    status: done
  - title: "See it in action + merged Quick start"
    status: done
  - title: "Consolidate installation passages"
    status: done
  - title: "Demote GSD comparison out of the intro"
    status: done
  - title: "Verify anchors and command honesty"
    status: done
verify:
  - title: "Read the new top region top-to-bottom for tone/flow"
    detail: "Hook → problem (both failure modes) → rhythm → demo → quick start. Subjective: does it sell the problem before the mechanics? Mechanical checks (anchors, headings, badges) are done."
  - title: "Render the page on GitHub and confirm the three badges resolve"
    detail: "npm version / node / license point at shields.io for mini-orchestrator. They can only be seen rendered; the markdown is correct but live image loading is a human eye check."
---

# Phase 131 — report from the auto session

## What was done
Reworked the **top region** of `README.md` into a problem-first layout and merged
the duplicated install/quick-start material.

- **H1 → `# mini-orchestrator`** (was `# mini`); added a note that the CLI command
  stays `mini` and the npm package is `mini-orchestrator` to defuse the rename.
- **Badges:** npm version + node + license only. No downloads badge, no CI badge.
  The CI badge stays commented out at the top (verified: line 7 still holds the
  "temporarily hidden" comment).
- **Problem-first intro:** hook ("short leash"), both agent failure modes (huge
  unreviewable leaps / sycophantic agreement), the *propose → plan → implement →
  verify* rhythm, and a benefit reframe toward "stay at the helm / won't burn
  your context window or usage limit". Benefit reframing kept to the intro only;
  "What gets sent to Claude" body section left untouched.
- **Restructure (not prepend):** new order is intro → `## See it in action` →
  `## Quick start` → `## Requirements` → `## Installation`.
- **`## See it in action`** reuses the existing `demo/cycle.gif` (raw
  githubusercontent URL) — not a placeholder. Caption now says it shows the
  *equivalent terminal (CLI) cycle*, so the GIF↔text mismatch reads as intended.
- **`## Quick start`:** `npm install -g` first, then the **slash-command flow**
  (`/mini:init → next → plan → do → done`) as the primary path, with the CLI loop
  + `mini auto` demoted to a `### Prefer the terminal?` subsection.
- **Installation consolidated:** the npx try-it, the no-sudo prefix tip and the
  from-git/dev block are now `<details>` blocks under one `## Installation`. The
  bare `npm install -g` fence appears in Quick start and once in Installation
  (the canonical install reference); no scattered duplicate install instructions.
- **GSD demoted:** removed from the top product definition; a short
  "started as a lighter-weight alternative to GSD" lead now sits in the existing
  `## Import from GSD` section.

## Verified mechanically
- All 5 in-page anchors used (`#auto-mode`, `#autonomous-miniauto`,
  `#installation`, `#machine-readable-project-map-graph`, `#status-line`) resolve
  to real headings.
- Exactly one `## Quick start` heading.
- No `npm/dm/...` downloads badge; CI badge still commented.
- GSD absent from the first 22 lines (intro).
- Every shown command exists: `/mini:init/next/plan/do/done` are generated by
  install-commands; the CLI counterparts and `mini auto` are real.

## Notes / open questions
- The GIF still shows the CLI cycle. Re-recording it for the slash flow is already
  in the backlog (`mini todo`), as are the deferred README pieces (mini vs. native
  plan mode, "your first phase", Sponsors lower, repo topics).
- No real architectural crossroads here — no `/mini:decision` needed.
