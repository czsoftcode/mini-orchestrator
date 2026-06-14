# Review findings

> Recorded by `mini findings add` (the adversarial and verify review steps).
> Each entry is `## <id> · <severity> · <status>`; do not hand-edit those header
> lines.

## 160-1 · should-know · open
**Where:** src/prompts/linkedFinding.ts:32-49
**Reviewed-at:** fa39151ab46bba530fb7c2f4fd31f955233e2b0c
**Source:** adversarial
Verify findings mislabeled as 'adversarial' in linked-finding block

This phase makes verify-sourced findings first-class and linkable via 'mini next --from-finding <id>' (the next prompt now offers it for open review findings of either source). But renderLinkedFindingBlock hardcodes '# Linked adversarial finding' and 'fix the adversarial finding below' in both the detail and the missing branch, and LinkedFindingDetail does not even carry 'source'. So when discuss/plan render a linked VERIFY finding, the planner is told to treat 'the adversarial finding' as the primary source — a factual mislabel this phase introduces. Before 160 only adversarial findings existed, so it was accurate; now it is wrong. Fix: thread source into LinkedFindingDetail and make the heading/body source-aware. The report disclosed this as out-of-scope, but it is a real user-visible inaccuracy caused by 160, not pre-existing.

## 160-2 · nit · open
**Where:** src/state/findingsStore.ts:246-253,285
**Reviewed-at:** fa39151ab46bba530fb7c2f4fd31f955233e2b0c
**Source:** adversarial
Unknown **Source:** value is silently downgraded to adversarial and overwritten on re-serialize

parseEntryBody consumes a **Source:** line whose value is not in FINDING_SOURCES and leaves source undefined, so parseFindings falls back to DEFAULT_FINDING_SOURCE (adversarial). serializeFindings then ALWAYS emits 'Source: <f.source>'. Net effect: if a future mini version writes a new source (e.g. 'security'), this version reading that file reports it as 'adversarial', and any write-back path (resolveFinding/reopenFinding via setFindingStatus, or addFinding appending a sibling) re-serializes the whole file and PERMANENTLY rewrites '**Source:** security' to '**Source:** adversarial' — silent forward-incompat data loss, not just a display fallback. Only 2 sources today so impact is theoretical, and it mirrors how ENTRY_RE handles unknown severities; recording so the trade-off is a conscious choice, not an accident.

## 160-3 · nit · open
**Where:** src/state/findingsStore.ts:230-253
**Reviewed-at:** fa39151ab46bba530fb7c2f4fd31f955233e2b0c
**Source:** adversarial
Metadata parsing is order-locked; a reordered/edited Source line swallows the title

parseEntryBody reads metadata in fixed positional order Where -> Reviewed-at -> Source, each only matched at the current cursor. A hand-edited file that puts '**Source:** verify' BEFORE '**Where:** ...' (e.g. someone tidying the file) makes WHERE_RE/REVIEWED_AT_RE miss, SOURCE_RE consume the Source line, and then the '**Where:**' line is taken as the TITLE while the real title slides into the body — the finding silently loses its location and gets a bogus title. Same class of fragility already existed for Where/Reviewed-at; phase 160 widens the surface by adding a third order-locked line. Machine round-trip (serializeFindings) is safe because it always emits canonical order; this only bites hand edits. Robust fix: scan the first N lines for any of the three metadata regexes regardless of order. Low priority.
