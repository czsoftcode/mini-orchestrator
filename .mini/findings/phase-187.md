# Review findings

> Recorded by `mini findings add` (the adversarial and verify review steps).
> Each entry is `## <id> · <severity> · <status>`; do not hand-edit those header
> lines.

## 187-1 · should-know · resolved
**Where:** src/prompts/sessionContext.ts:393; src/commands/context.ts:241
**Reviewed-at:** 9e231507c6cb18f1e089d80b3245b50bdfeaf75c
**Source:** adversarial
**Reason:** fixed within phase 187
done close-list offers findings raised against the current phase / claimed by other fix-phases

buildDoneSessionPrompt filters the offered --resolve-finding list only by 'id !== phase.fromFinding'. That leaves in two dangerous classes: (1) findings the adversarial step just raised AGAINST the current phase (origin phase == current phase, e.g. phase-187.json), which by definition are NOT fixed by this phase but are presented under 'only if this phase fixed it'; (2) open findings that another PLANNED fix-phase already owns via its own fromFinding (next.ts:214 leaves them open until that phase's done). Closing one of class (2) here makes that future phase's done resolveFinding a tolerant no-op and creates an undo asymmetry (its fromFinding reopen vs this phase's resolvedFindings). Only the human gate prevents closing a real unfixed blocker or stealing another phase's finding. The list should at least exclude findings whose origin == current phase and/or findings already linked as some phase's fromFinding.

## 187-2 · should-know · resolved
**Where:** src/cli.ts:235; src/commands/done.ts:633,647
**Reviewed-at:** 9e231507c6cb18f1e089d80b3245b50bdfeaf75c
**Source:** adversarial
**Reason:** fixed within phase 187
--resolve-finding silently dropped on every non-finalizing done path (no warning)

The flag is consumed only inside 'if (opts.apply)' (cli.ts) and only reaches resolveFinding via finalizePhaseSideEffects, which runs AFTER the phase is confirmed done. So every path that returns before finalize swallows --resolve-finding with no message: (a) 'mini done --resolve-finding X' without --apply; (b) --apply with pending verify items and no --acceptVerify (done.ts:647 short-circuits); (c) --apply with unfinished/blocked steps remaining (done.ts:633 returns early). In all three the user is told the phase isn't closed but is NOT told the findings they asked to close were ignored, so they may believe findings were resolved when they weren't. The report lists 'ignored without --apply' as known, but the verify/unfinished-steps drops are undocumented and equally silent. A one-line warn ('--resolve-finding ignored: phase not finalized') would make it loud.

## 187-3 · nit · resolved
**Where:** src/commands/done.ts:268-281; done.test.ts; undo.test.ts
**Reviewed-at:** 9e231507c6cb18f1e089d80b3245b50bdfeaf75c
**Source:** adversarial
**Reason:** fixed within phase 187
Unhappy-path test gaps + no id normalization in finalize

Logic looks correct on the paths I traced (re-apply guarded by phase.status==='done' at done.ts:47; resolveFinding returns true only on a real open→resolved flip; each resolveFinding re-reads disk so sequential closes to the same file are safe; undo reopens resolvedFindings symmetrically). Two small gaps remain: (1) finalize does not trim/normalize ids and the dedup 'seen' set keys on raw strings, so ' 167-7' and '167-7' are distinct entries and a whitespace/garbage id is a silent no-op (acknowledged in report, untested). (2) Tests cover the happy path well but miss: duplicate ids within a single --resolve-finding invocation (dedup is only tested against fromFinding, not against a repeated extra), undo of a phase that has BOTH fromFinding AND resolvedFindings, and the documented 'ignored without --apply' behavior. None block; they are the unhappy paths the suite does not pin down.
