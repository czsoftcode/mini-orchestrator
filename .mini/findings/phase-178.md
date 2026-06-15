# Review findings

> Recorded by `mini findings add` (the adversarial and verify review steps).
> Each entry is `## <id> · <severity> · <status>`; do not hand-edit those header
> lines.

## 178-1 · blocker · resolved
**Where:** src/cli.ts:401-403 vs src/prompts/sessionContext.ts:619,693
**Reviewed-at:** 0c27cc6c5aa7889af8fae83a06f56c28a41b1d64
**Source:** adversarial
adversarial-project workflow is unrecordable: prompt says 'mini findings add --source project' but CLI --source only allows adversarial|verify

The adversarial-project prompt (sessionContext.ts:619,693) and the skill instructions command the reviewer to 'follow the printed instructions exactly' and record each finding via:
  mini findings add --source project ...
But cli.ts:403 declares .choices(['adversarial', 'verify']) for --source, so commander rejects 'project' with exit 1 ('argument project is invalid') BEFORE the store is reached. The help text at cli.ts:391 also states '--source is adversarial | verify (default adversarial)'.

Yet the data model fully supports it: findingsStore.ts:56/61 define FindingSource as 'adversarial'|'verify'|'project' and FINDING_SOURCES includes 'project'; isFindingSource('project') returns true. So only the CLI option list was never updated — a half-wired feature.

Effect: every reviewer who follows the adversarial-project prompt literally cannot record a single finding the prescribed way. I hit this directly recording the findings for THIS review and had to fall back to --source adversarial, which mislabels their origin in the store.

NOTE ON SCOPE: introduced earlier (enum in phase 161, prompt in phase 163, CLI restriction in phase 160) — NOT a regression of the 172-178 range. But it is a live blocker, and phases 175/177/178 edited the adversarial-project prompt without noticing the command they instruct is broken. Fix: add 'project' to the CLI choices and the help string.

All findings in this review were recorded with --source adversarial as a workaround; their true origin is the project (range) review.

## 178-2 · should-know · resolved
**Where:** src/state/runReport.ts:127-148
**Reviewed-at:** 0c27cc6c5aa7889af8fae83a06f56c28a41b1d64
**Source:** adversarial
stripFindingsSections is blind to code fences — silently truncates report bodies that contain a '## Adversarial findings' line inside a fenced block

stripFindingsSections() (phase 177) scans line-by-line for ATX headings with no awareness of ```/~~~ code fences. Two silent failure modes, both on the body inlined into the done/verify/adversarial prompts:

(1) A report whose impl log contains a fenced example with a literal '## Adversarial findings' (or '## Verify findings') line — very plausible here because phases 176-178 are themselves ABOUT findings-section handling and a future `do` report could document the format — starts skipping at that line and drops everything up to the next ##/# heading or EOF, including the closing fence and any prose after it. Concrete input:
  '## What was done\nExample:\n```md\n## Adversarial findings\n- x\n```\nDone notes.'
  => output drops the fence, the example AND 'Done notes.', silently.

(2) Conversely, a genuine stale findings section that itself contains a fenced block with any '##'/'# ' line ends skipping early (level<=2 resets the flag), leaking the tail of the stale section back into the prompt.

Impact is bounded: only the rendered prompt is affected, the on-disk report is untouched, so it is not persistent data loss. But the reviewer/done flow silently sees a truncated implementation report. runReport.test.ts covers exact-title, case, CRLF/BOM, end-of-body and stop-at-#, but has no fenced-code-block case. Fix: track fence state and ignore headings while inside a fence.

## 178-3 · should-know · resolved
**Where:** src/state/store.ts:202-216 + src/commands/doctor.ts:319
**Reviewed-at:** 0c27cc6c5aa7889af8fae83a06f56c28a41b1d64
**Source:** adversarial
CorruptPhaseError crashes 'mini doctor' (and other read-only commands): doctor's load() is the only unguarded read in a function where every sibling read is try/catch-wrapped

Phase 176 changed readPhaseFile so a present-but-unparseable phase file (truncated, half-written, or carrying git merge-conflict markers — the project explicitly resolves .mini conflicts via git, so this is a realistic state) throws CorruptPhaseError instead of returning null. assembleState (store.ts:223) calls it for EVERY phase in the header, so ONE corrupt .mini/phases/phase-N.json makes loadFullState() throw, taking down every command that loads full state.

This is a regression vs the previous graceful degradation (corrupt -> null -> bare header summary). The doc on CorruptPhaseError justifies failing loud for WRITE paths (avoid making detail loss permanent on next save) — defensible. But it also breaks read-only/diagnostic paths:

- mini doctor is the tool you run to find out WHY the project is broken. doctor.ts wraps every directory read in try/catch (listRunDir 219-225, listDecisionDir 244, readCache) returning [] on failure — but the 'const state = await load(cwd)' at doctor.ts:319 is BARE. So a single corrupt phase file makes doctor throw CorruptPhaseError, print none of its other checks, and exit 1 — the diagnostic is bricked by exactly the corruption it should report.

The top-level CLI catch (cli.ts:689) does print the message ('Corrupt phase file <path>: ...') and exit 1, so it is loud, not an opaque stack trace. But doctor specifically should catch this and render it as a failed check (like its other wrapped reads) rather than aborting. Same blast-radius concern applies to other read-only commands (status, etc.) that load full state. No test covers a corrupt phase file flowing through doctor.
