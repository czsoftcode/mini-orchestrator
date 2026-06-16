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
