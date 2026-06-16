# Review findings

> Recorded by `mini findings add` (the adversarial and verify review steps).
> Each entry is `## <id> · <severity> · <status>`; do not hand-edit those header
> lines.

## 184-1 · should-know · open
**Where:** src/commands/do.ts:281, src/prompts/autoPhase.ts:55
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** project
**Range:** 26-30
Slash /mini:do never sets phase to 'doing', so Phase 29's --step-done always fails

Phase 29 added 'mini do --apply --step-done "<title>"' for mid-session progress, and wired the instruction into buildAutoPhasePrompt (the prompt /mini:do prints via 'mini context do'). But applyStepDone (do.ts:281) hard-requires phase.status==='doing' and returns 'phase-not-doing' (exit 1) otherwise. In the slash flow nothing transitions the phase to 'doing': 'mini context do' is read-only, the generated do.md body only runs 'mini context do', and the autoPhase prompt only ever instructs '--step-done', never 'mini do --apply' (applyDoStart) first. After /mini:plan the phase is 'planned', so every '--step-done' Claude runs during /mini:do exits 1 and records nothing — the crash-resilience trace that is Phase 29's whole point is dead in the slash flow. It DOES work via terminal 'mini do' only because doPhase saves status='doing' before spawning Claude (do.ts:122). Degraded rather than fatal: the error hint ('Nejdřív spusť: mini do --apply') may let an agent self-heal, and the final report still closes the phase in 'mini done'. Fix: have /mini:do's body (or the prompt) call applyDoStart before the step loop, or relax the 'doing' precondition.

## 184-2 · should-know · open
**Where:** src/commands/context.ts:118-143, src/commands/done.ts:431-443,772
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** project
**Range:** 26-30
Corrupt run report: /mini:done shows a ready-to-close prompt, then 'mini done --apply' hard-fails after the user confirms

The two halves of /mini:done disagree on what a corrupt report means. buildDoneContext (context.ts:118) reads the report tolerantly: on RunReportParseError it swallows the error, sets verify=[] and returns the normal done prompt ('Claude žádné neuvedl — ověřil vše sám' + 'mini done --apply'). So Claude tells the user the phase is implemented and fully verified and asks 'does it work?'. After the user confirms, Claude runs 'mini done --apply' -> applyDone -> applyAutoReport, which on the SAME parse error returns {handled:false} (done.ts:431-443); applyDone then errors 'Report chybí nebo je poškozený' and exits 1 (done.ts:772). Net effect: the prompt is misleading (claims everything is verified over an unreadable report) and the workflow dies with a hard failure right after the human signed off. Extra confusion: applyAutoReport logs 'Přepínám do interaktivního módu' but applyDone has no interactive fallback, so that message is false in the --apply path. Make the context path surface the corruption (so the prompt warns instead of claiming 'verified'), or align the two on tolerance.

## 184-3 · nit · open
**Where:** src/version.ts:66-70, src/commands/done.ts:319-320
**Reviewed-at:** 27db80fe973c2acf0af8a30a8ef57250d8a1a6ae
**Source:** project
**Range:** 26-30
Version bump silently no-ops on a non-semver version and edits the first "version" string in the file

bumpPackageVersion (version.ts) regex-matches the FIRST '"version": "..."' in package.json. For a normal package.json that is the top-level field, but JSON key order is not guaranteed and a 'version' string in an earlier block would be bumped instead. More notable: if the value is not /^\d+\.\d+\.\d+/ (e.g. 'v1.2.3', '0.0.0-dev' already handled by truncation, or a templated value), bumpSemver returns null -> bumpPackageVersion returns null and writes nothing. done.ts:319-320 only logs when r is truthy ('if (r) log.dim(...)'), so a skipped bump is completely silent — the phase commit proceeds with no version change and no warning, contradicting the prompt's promise that done 'navýší verzi (default patch)'. Low impact (mini's own package.json is well-formed), but it's a silent assumption: a malformed/non-semver version field is swallowed rather than reported.
