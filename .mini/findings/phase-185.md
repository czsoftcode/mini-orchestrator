# Review findings

> Recorded by `mini findings add` (the adversarial and verify review steps).
> Each entry is `## <id> · <severity> · <status>`; do not hand-edit those header
> lines.

## 185-1 · should-know · open
**Where:** src/commands/findings.ts:findingsSetStatus → src/state/findingsStore.ts:setFindingStatus
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** adversarial
Manual resolve/reopen silently deletes parser-unreadable entries from the phase file

setFindingStatus does read→parseFindings→serializeFindings→write. parseFindings drops any entry it cannot round-trip (malformed header, missing title, or — per the phase's own discuss note — an unknown/future metadata field it 'silently downgrades'). So the first manual resolve/reopen over a file that contains such an entry physically erases it. Confirmed live: a phase-005.md with a well-formed 5-1 and a title-less 5-2; 'mini findings resolve 5-1' rewrote the file and 5-2 was gone. This destructive reserialize already existed in the store, but before this phase it only fired on the narrow auto-resolve at 'done' for a --from-finding-linked finding. This phase turns it into a routine, user-initiated command over ARBITRARY findings (incl. another mini version's newer-format entries), widely exposing the data loss. Shipping a write command on a parser the team already knows is fragile (186 deferred) is the risk.

## 185-2 · should-know · open
**Where:** src/cli.ts:417-466 ; src/commands/findings.test.ts
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** adversarial
New variadic CLI wiring (findings [action] [ids...]) has no automated test

The 9 new tests all call findingsResolve/findingsReopen directly and never go through commander. The shared .action signature changed from (action, opts) to (action, ids, opts) — an extra positional that shifts opts. That reorder is exactly the regression a direct-call test cannot catch; only the manual one-off smoke test in the report exercised it. The test file already imports execFile but uses it only for git setup, never to spawn dist/cli.js, so there is zero coverage that variadic ids actually reach the function and that opts is not clobbered for add/list. If someone later edits the signature, all unit tests stay green while the CLI breaks. (Consistent with add/list having no CLI test, but the variadic shift is genuinely new surface.)

## 185-3 · nit · open
**Where:** src/commands/findings.ts:findingsSetStatus (no dedup of cleaned)
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** adversarial
Duplicate id in one batch prints contradictory lines (resolved + already resolved)

Confirmed live: 'mini findings resolve 5-1 5-1' prints 'Finding 5-1 resolved.' then 'Finding 5-1 is already resolved.' (the second iteration re-reads from disk after the first wrote). Harmless, exit 0, but confusing. The cleaned id list is not deduped.

## 185-4 · nit · open
**Where:** src/commands/findings.ts:findingsSetStatus (cleaned filter)
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** adversarial
Empty/whitespace ids mixed with valid ids are silently dropped, no note

Confirmed live: 'mini findings resolve "" 5-1' resolves 5-1 and never mentions the empty argument. The no-id error only fires when the WHOLE list is empty; a typo'd empty arg inside a batch vanishes silently. Minor, but a silent drop where the user might expect a complaint.

## 185-5 · nit · open
**Where:** src/commands/findings.ts:findingsSetStatus (else after flip())
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** adversarial
Write-failure branch returns reason:'not-found', mislabeling the cause

When the pre-check passes but flip() returns false (only reachable on a write error, since the no-op cases were already ruled out), the code sets anyMissing=true and the call returns reason:'not-found'. Exit code is correct, but the StepOutcome reason and any telemetry/caller branching on it would misattribute a disk write failure as a missing id. Cosmetic.

## 185-6 · nit · open
**Where:** src/state/findingsStore.ts:listFindings regex vs findingsPath/findFindingById (phaseStem)
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** adversarial
list can show a finding that resolve reports as 'No such finding' (filename width asymmetry)

listFindings matches ^phase-\d+(\.\d+)?\.md$ (any width) while findFindingById reads via the zero-padded phaseStem (phase-005.md). For files mini writes these always agree. But a hand-created/older unpadded phase-5.md is LISTED yet unresolvable -> 'No such finding: 5-1' though list shows it open (I hit exactly this during review). Pre-existing, but this phase's resolve command is the first user-facing place the inconsistency bites.
