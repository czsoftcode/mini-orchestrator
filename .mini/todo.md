# Ideas & changes

> Archive of future ideas and changes for this project. Managed by `mini todo`
> (`add` / `done` / `remove`); `mini next` offers the open items as candidate
> phase ideas. You can also edit this checklist by hand.
- [ ] Decision records: consistency — mini doctor orphan-check (decision file with no matching phase, same pattern as stale run reports) and mini undo removes/restores the decision file.
- [x] adversarial-project (2/7): range-resolution helper — resolve --from-phase N/--to-phase M to {fromSha,toSha} from stored autoCommit.preSha via loadPhase (fromSha = preSha of N; toSha = preSha of M+1, else HEAD when M is last); plain git-ref passthrough for --from/--to; hard-fail on missing preSha, invalid ref, empty range, or mixing phase+ref in one run. Unit-test every failure path. No git-subject derivation.
- [x] adversarial-project (3/7): prompt/context builder (buildProjectAdversarialContext + prompt) — thin index, not a data dump: project.md, resolved range, phase id+title list (loadPhase, NOT full reports), explicit `git diff <from>..<to>` for the reviewer to run, independent-reviewer role, dedup-first via `mini findings list`, security delegated to /security-review, findings via `mini findings add --source project`. Snapshot test.
- [x] adversarial-project (4/7): interactive `mini adversarial-project --from-phase/--to-phase` (and --from/--to) — fresh workWithClaude session with scoped read-only tools (Read/Grep/Glob/LS, git diff/log/show, mini findings list, mini findings add; NO Edit); attribute findings to the range's end phase. Mirror adversarial.ts.
- [ ] adversarial-project (5/7): `mini context adversarial-project` subcommand prints the same prompt for the slash path; share the builder from 3/7, wire the same flags.
- [ ] adversarial-project (6/7): generate `/mini:adversarial-project` slash command idempotently via install-commands (body calls `mini context adversarial-project`); extend install-commands.test.ts.
- [ ] adversarial-project (7/7): docs — README + `mini --help` entry, `mini doctor` counts the new command, CHANGELOG via /mini:done. Manual-only by design: no `auto`/heuristic wiring.
- [ ] Adversarial re-run dedupe: strip existing '## Adversarial findings'/'## Verify findings' sections from the report body before embedding it as '# Implementation report', so repeated adversarial runs don't stack duplicated/recursive findings and the reviewer doesn't read prior verdicts as the implementation log.
- [ ] store.ts loadPhase/readPhaseFile swallows every error (ENOENT and malformed JSON alike) -> when currentPhaseId is set but the phase file is corrupt, verify/adversarial print a misleading 'no phase' message and steer to /mini:next. Distinguish missing from corrupt and report the real problem.
