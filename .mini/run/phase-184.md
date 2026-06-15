---
phase: 184
verdict: done
steps:
  - title: "Add range field + Range serialization"
    status: done
  - title: "Make metadata parsing order-independent"
    status: done
  - title: "Thread range through addFinding"
    status: done
  - title: "Wire --range into CLI + findings add"
    status: done
  - title: "Update adversarial-project prompt to pass range"
    status: done
  - title: "Tests"
    status: done
---

# Phase 184 — report from the auto session

## What was done

`mini findings add` now accepts an optional, universal `--range "<from-to>"` flag
that stores a `**Range:**` metadata line on the finding. A range review
(`adversarial-project`) records the whole phase range it inspected, so a later
reader sees the scope — not just the single origin phase the finding is filed
under. Single-phase reviews simply don't pass the flag (it's universal, not tied
to `--source`).

Concretely:

- **`findingsStore.ts`** — added optional `range?: string` to `Finding` and
  `NewFinding`; `serializeFindings` emits `**Range:**` in canonical order
  (Where → Reviewed-at → Source → Range → title); `addFinding` writes it (with
  newline collapsing, like the title) when non-empty, omits it otherwise.
- **`parseEntryBody` rewritten to be order-independent** — it now consumes any
  leading `**Where:**` / `**Reviewed-at:**` / `**Source:**` / `**Range:**` line
  in any order, each at most once, until the first non-metadata line (the title).
  This both adds Range and removes the position-locked fragility flagged in
  findings 160-2/160-3: a hand-reordered metadata block no longer swallows the
  title. The machine serializer still emits a fixed order, so round-trips are
  unchanged.
- **CLI (`cli.ts`) + `findings.ts`** — `--range` option registered and threaded
  through `findingsAdd` → `addFinding`; `mini findings list` shows the range in
  braces `{1-5}` when present.
- **adversarial-project prompt (`sessionContext.ts`)** — computes a range label
  from the in-range phases (`first-last`, or a single id for a one-phase range)
  and instructs the reviewer to keep `--range "<label>"` on every finding. In ref
  mode (range given as plain git refs, no phase list) it tells them to omit
  `--range` instead.

## Trade-offs / what to watch

- **Range is stored per-finding, not per-review-pass.** The findings store has no
  "review pass" entity, so every finding from one range review carries the same
  `**Range:**` value — redundant but cheap, and it survives even if findings get
  split across phase files. This was the conscious trade-off agreed in planning.
- **The order-independent parser is a behavior change**, not purely additive.
  Old canonically-ordered files parse identically (covered by a back-compat
  test), but the *failure mode* for a hand-broken file changed: a reordered
  metadata block now parses correctly instead of corrupting the title. A repeated
  metadata line (e.g. two `**Range:**`) is treated as the title from the second
  one on — covered by a test so a stray duplicate can't silently vanish.

## Verification

- `npm run typecheck` — clean.
- `npm run build` — compiles, assets copied.
- Full suite: **1226 tests pass** (added: round-trip with range, order-independent
  parse, repeated-metadata-as-title, range omitted/back-compat, `addFinding`
  persist/omit/newline-collapse, command-level `--range` add + `{range}` list
  render, three adversarial-project prompt assertions incl. single-id label and
  ref-mode omission).
- Built CLI `findings --help` shows the `--range` option registered.

A true end-to-end run of the built CLI against a throwaway project was blocked by
the sandbox; the commander `--range` → `opts.range` seam is identical to the
existing `--where`/`--source` mappings and is exercised by the unit tests, so it
is covered indirectly rather than by a fresh manual run.

## Docs

Not touched in this phase (out of plan scope). The `CHANGELOG` entry is written by
`/mini:done`. If you want `docs/` (the adversarial-project / findings command docs)
to mention `--range`, that's a small follow-up worth a `mini todo` note.
