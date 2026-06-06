# Phase 132 — README: mini vs. native plan mode

**Goal:** Add a 'How is this different from Claude Code's plan mode?' section to README.md with a short comparison table (persistence, cross-session, progress tracking, git auto-commit, auto mode), preempting the 'why not the built-in plan mode?' question; frame it as a difference in approach rather than hard claims about what native plan mode cannot do.

## Steps
- [done] Insert section after Installation
- [done] Fact-check claims vs Claude Code and README
- [done] Verify markdown and structure

## Auto-commit
- Phase 132: README: mini vs. native plan mode

## Discussion
# Phase 132 — README: mini vs. native plan mode

## Intent
Add a "How is this different from Claude Code's plan mode?" section to
`README.md` to preempt the obvious objection ("Claude Code already has plan mode
and todos — why do I need mini?"). Source draft: `~/Documents/draft_readme.md`
(lines 85–112). Tone must be honest and disarming, not a hard sell: open by
acknowledging native plan mode exists and may be all some users need, then frame
mini as a *persistent, multi-session layer on top of that idea* — a difference in
approach, not a list of things native plan mode "can't do".

## Key decisions
- **Placement: after `## Installation`, before `## Commands`.** High visibility,
  but it doesn't disrupt the intro → quick start → install → use flow.
- **Heading: `## How is this different from Claude Code's plan mode?`**
- **Fix the inaccurate "Progress tracking: None" row.** Claude Code DOES have
  in-session todos (TodoWrite) and a plan mode that drafts → waits for approval.
  Do NOT claim it has no progress tracking. Reframe around **persistence**: native
  = ephemeral, in-memory, per session; mini = persistent phase state on disk in
  `.mini/`, versioned with the code, resumes across sessions.
- **Trim the draft's overlapping rows.** The draft table has separate Scope /
  Persistence / Progress tracking / Across sessions / Memory / Git / Autonomy rows
  — Persistence, Progress tracking and Across sessions all say the same thing.
  Merge them into one honest "Persistence" row. Proposed final rows:
  - Scope — a single answer/turn │ a whole project, phase by phase
  - Persistence — in-memory, per session (ephemeral todos) │ on disk in `.mini/`, versioned, resumes across sessions
  - Memory — none │ summaries of completed phases for continuity
  - Git — manual │ optional auto-commit per phase
  - Autonomy — one plan at a time │ `/mini:auto` chains phases with human checkpoints
- **Keep the closing "Use native plan mode for a one-off… / Use mini when a
  project spans many sessions…" paragraph** — it's fair and sets expectations.

## Watch out for
- **Factual accuracy about Claude Code.** Every claim about native plan mode must
  be true as of now: it has plan mode (drafts a plan, waits for approval before
  editing) AND in-session todos. The differentiator is persistence/cross-session,
  not "native has nothing". A stale/false claim here destroys trust in the very
  section meant to build it.
- **No duplicate / contradicting content** with the existing `## Auto mode` and
  FAQ sections (e.g. the auto-commit and `/mini:auto` claims must match what those
  sections already say).
- **Markdown table renders on GitHub** (header + separator row, escaped pipes if
  any) — can only be fully confirmed rendered; build the table carefully.
- **English only** (project rule).
- Single new section, no reordering of existing sections beyond inserting it — keep
  the change small and low-risk.

## Run report
---
phase: 132
verdict: done
steps:
  - title: "Insert section after Installation"
    status: done
  - title: "Fact-check claims vs Claude Code and README"
    status: done
  - title: "Verify markdown and structure"
    status: done
verify:
  - title: "Render the section on GitHub and read it for tone"
    detail: "Does the comparison table render correctly and read as honest (a difference in approach, not a hit piece on native plan mode)? Mechanical checks (one heading, 5+2 table rows, anchors intact) are done."
---

# Phase 132 — report from the auto session

## What was done
Added a new `## How is this different from Claude Code's plan mode?` section to
`README.md`, placed between `## Installation` and `## Commands` (per the
discussion).

- **Honest opening:** acknowledges Claude Code already has plan mode AND an
  in-session todo list, and that it may be all some users need.
- **Framing = scope + persistence:** native plan mode and its todos are in-memory
  and ephemeral (gone when the session ends); mini is the persistent, multi-session
  layer on disk. No false "native has nothing" claims.
- **5-row table** (Scope, Persistence, Memory, Git, Autonomy) — the draft's
  overlapping Persistence / Progress tracking / Across sessions rows merged into
  one honest Persistence row.
- **Closing guidance:** "use native plan mode for a one-off / use mini when a
  project spans many sessions".

## Verified mechanically
- Exactly one occurrence of the new heading.
- Table is well-formed: header + separator + 5 data rows (7 `|`-lines), 3 columns
  throughout.
- All in-page anchors still resolve (`#auto-mode`, `#autonomous-miniauto`,
  `#installation`, `#machine-readable-project-map-graph`, `#status-line`); the new
  section adds no internal links.
- Cross-checked the two factual claims against the existing body: "optional
  auto-commit per phase" matches the `mini done` row / FAQ (auto-commit on done,
  default `--bump none`); "`/mini:auto` chains phases with human checkpoints"
  matches the `### Autonomous /mini:auto` section.
- English-only.

## Notes / open questions
- Section placement and wording follow the discussion notes exactly; small,
  additive change, no reordering of existing sections.
- No architectural crossroads — no `/mini:decision` needed.
