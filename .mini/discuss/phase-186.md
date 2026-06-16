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
