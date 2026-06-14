# Ideas & changes

> Archive of future ideas and changes for this project. Managed by `mini todo`
> (`add` / `done` / `remove`); `mini next` offers the open items as candidate
> phase ideas. You can also edit this checklist by hand.
- [ ] Decision records: consistency — mini doctor orphan-check (decision file with no matching phase, same pattern as stale run reports) and mini undo removes/restores the decision file.
- [ ] adversarial project
- [ ] Adversarial/verify: apply the three-state report handling (valid/corrupt/missing) to mini:verify too — verify still tells the reviewer to append findings into an unparseable/missing report, so they get silently dropped on the next done. Mirror adversarialContext.ts.
- [ ] Adversarial re-run dedupe: strip existing '## Adversarial findings'/'## Verify findings' sections from the report body before embedding it as '# Implementation report', so repeated adversarial runs don't stack duplicated/recursive findings and the reviewer doesn't read prior verdicts as the implementation log.
- [ ] store.ts loadPhase/readPhaseFile swallows every error (ENOENT and malformed JSON alike) -> when currentPhaseId is set but the phase file is corrupt, verify/adversarial print a misleading 'no phase' message and steer to /mini:next. Distinguish missing from corrupt and report the real problem.
- [ ] čtení adversarial v next/plan/do
- [x] Adversarial findings: record HEAD SHA at review time as metadata (reviewed-at: <sha>) inside each finding — keep phase as the primary key, just stamp which code state was reviewed. Additive to findingsStore (optional field), surfaced in mini findings list. Lets a later consumer judge whether a finding is still relevant after the code moved on.
