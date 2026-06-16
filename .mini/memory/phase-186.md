# Phase 186 — Robust finding source and resolve reason

**Goal:** Preserve an unknown **Source:** value verbatim instead of downgrading it to adversarial (160-2), and add an optional --reason to 'mini findings resolve' to record why a finding was closed.

## Steps
- [done] Preserve & display unknown source (160-2)
- [done] Add reason field with round-trip
- [done] Thread reason into resolve, clear on reopen
- [done] Wire --reason CLI flag + reject on reopen

## Auto-commit
- Phase 186: Robust finding source and resolve reason

## Discussion
# Phase 186 — Robust finding source and resolve reason

## Intent
Two changes to the findings store, both touching the `parseEntryBody`/`serializeFindings`
round-trip in `src/state/findingsStore.ts`:

1. **Fix 160-2 — preserve an unknown `**Source:**` value.** Today an unrecognized
   source (e.g. a future `security`) is parsed to `undefined`, falls back to
   `DEFAULT_FINDING_SOURCE` (`adversarial`), and is then *permanently rewritten*
   to `adversarial` on the next serialize (resolve / reopen / add / done auto-close).
   That is silent forward-incompat data loss, not a display fallback. The fix must
   keep the original token on disk through any round-trip.

2. **Add `--reason` to `mini findings resolve`.** Optional flag that records *why*
   a finding was closed, stored on the entry and round-tripped.

160-3 (order-locked parse) is already fixed in the current code — `parseEntryBody`
is order-independent. Nothing to do there; the linked todo bundled it.

## Key decisions
- **Unknown source is preserved AND displayed verbatim.** Keep typed `source:
  FindingSource` (default `adversarial`) for logic, but also carry the raw token
  (e.g. `rawSource?: string`) set only when the `**Source:**` value is not a known
  source. Serialize emits the raw token when present, else `f.source`. `listFindings`
  and any source display must use `rawSource ?? source` — no misleading `adversarial`.
- **`--reason` storage:** new optional `reason?: string` on `Finding`, serialized as
  a `**Reason:**` metadata line; parser consumes it order-independently (new RE +
  branch) and old files without it round-trip unchanged.
- **Reason is cleared on reopen.** Reason means "why it was closed"; `reopenFinding`
  (incl. the one `mini undo` calls) must drop the reason. Consistent with undo's
  "as if it never happened".
- **`--reason` only on `resolve`.** `mini findings reopen --reason` is rejected
  (error/warning), not silently ignored.
- **Resolving an already-resolved finding with `--reason` stays a no-op** — do not
  overwrite the existing reason (keeps the idempotent contract honest). Plan to
  confirm explicitly.
- **Out of scope:** hardening unknown severity/status. `ENTRY_RE` drops the whole
  entry on an unknown severity (worse than Source), but widening that is a separate
  concern — do not pull it in.

## Watch out for
- `setFindingStatus` is shared by `resolveFinding`/`reopenFinding` and is called by
  `mini done` (auto-close, no reason) and `mini undo` (reopen). Thread the optional
  `reason` through the resolve branch only; do not change the done/undo signatures'
  behavior. The done auto-close path passes no reason → field stays empty.
- Multi-id batch: a single `--reason` applies to every id in the batch. Keep the
  existing per-id partial-failure reporting and aggregate exit code.
- The new `**Reason:**` line goes through the very parser being hardened — verify it
  is consumed (not swallowed into the title) and round-trips, including when mixed
  in any order with `**Where:**`/`**Reviewed-at:**`/`**Source:**`/`**Range:**`.
- Pick a canonical serialize slot for `**Reason:**` (parser is order-independent, so
  placement is cosmetic — e.g. last, or right after `**Source:**`).
- Tests must cover: unknown-source round-trip (read → write → reopen → value
  unchanged on disk), resolve `--reason` happy path, reason cleared on reopen,
  `reopen --reason` rejected, already-resolved + `--reason` no-op, multi-id with
  one reason, and old file (no `**Reason:**`/unknown source) round-trip.

## Run report
---
phase: 186
verdict: done
steps:
  - title: "Preserve & display unknown source (160-2)"
    status: done
  - title: "Add reason field with round-trip"
    status: done
  - title: "Thread reason into resolve, clear on reopen"
    status: done
  - title: "Wire --reason CLI flag + reject on reopen"
    status: done
---

# Phase 186 — report from the auto session

Both halves of the phase are implemented and covered mechanically. Full suite:
**1245 tests pass**, typecheck and lint clean.

## What was done

**160-2 — unknown source preserved (step 1).** Added `rawSource?: string` to
`Finding`. `parseEntryBody` now captures the `**Source:**` token once; a known value
sets the typed `source`, an unknown non-empty value is kept in `rawSource` (typed
`source` still falls back to `adversarial` for logic). `serializeFindings` writes
`f.rawSource ?? f.source`, so a forward-incompat value (e.g. `security`) round-trips
on disk instead of being silently rewritten. `renderFinding` shows `rawSource ??
source`. The old test that asserted the downgrade was rewritten to assert
preservation (read → serialize → value unchanged, no `adversarial`).

**Reason field + round-trip (step 2).** Added `reason?: string`, a `REASON_RE`, an
order-independent parse branch, and a `**Reason:**` serialize line placed right after
`**Source:**`. Old files with no `**Reason:**` round-trip unchanged.

**Resolve/reopen lifecycle (step 3).** `setFindingStatus` takes an optional `reason`;
it is applied only on the open→resolved flip (so re-resolving an already-resolved
finding does NOT overwrite an earlier reason — the existing `status === target`
no-op short-circuits before any write). Reopen deletes the reason. `resolveFinding`
gained the optional 3rd param; `mini done` auto-close and `mini undo` (which call
without a reason) are unchanged.

**CLI wiring (step 4).** `--reason <text>` added to the `findings` command; one reason
applies to the whole id batch (bound into the `flip` closure so per-id reporting and
the aggregate exit code are untouched). `mini findings reopen --reason` is a usage
error (`reason: 'reason-not-allowed'`), not a silent ignore. Updated the command
description and `docs/non-interactive/findings.md` (synopsis, description, options
table, entry-format note, example, notes).

## Notes / things I decided

- **Empty `**Source:**` is out of scope.** A line `**Source:** ` is trimmed to
  `**Source:**` before the regex, which then doesn't match `\s+(.*)`, so it becomes
  the title — a pre-existing edge unrelated to 160-2. I dropped a test that assumed
  otherwise rather than change unrelated behavior.
- **Severity/status forward-compat untouched**, as agreed in discussion — an unknown
  severity still drops the whole entry (`ENTRY_RE`); widening that is a separate concern.

## Not verified mechanically
A real CLI smoke test (`tsx src/cli.ts findings …` in a temp project) was denied by
the permission prompt twice, so it was not run. The same paths — raw-source round-trip,
`resolve --reason`, reason cleared on reopen, `reopen --reason` rejected, multi-id
batch — are all covered by the unit tests, so this is redundant rather than a gap.

## For the human
- Finding **160-2** stays open until you verify and close it (this phase records the
  `--from-finding 160-2` link but does not auto-resolve). You can now close it with a
  reason: `mini findings resolve 160-2 --reason "fixed in phase 186"`.
