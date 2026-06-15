# Security review — 06f54f4..0a89dd0

- **Range:** `git diff 06f54f441807ccd63ad65fb178d763ca2be4464e..0a89dd00043e3cd5accbd9ab2dfc6db705e7c5b8`
- **Reviewed at:** HEAD `0a89dd0` (mini-orchestrator v1.21.3)
- **Method:** Targeted security-sink pass, not an exhaustive line-by-line audit.
  The range is a single commit (Phase 171) that wires up the `/mini:security`
  slash command and refactors the resolve+build path. I traced the new routing
  (`mini context security` → `buildSecurityContext`), the extracted builder, the
  installed slash-command template, and re-checked the report-path construction
  it reuses. Process-spawn, parsing and dependency surface were each checked for
  *new* sinks introduced by this commit.
  **Independence caveat:** this review ran *inline* via `/mini:security`, so it
  shares this session's context and blind spots and ran without the scoped tool
  set the terminal `mini security` enforces — exactly the limitation SEC-1 below
  describes.
- **Threat model:** Local developer CLI, no network/auth. The attacker owns a
  cloned/pulled repo and controls `.mini/` (`state.json`, `project.md`, phase
  titles/goals, diff content). Phase 171 adds an **inline** path that feeds the
  security-review prompt — which by design ingests the *most* hostile content (a
  poisoned diff plus `.mini/`) — into the running Claude session. The relevant
  categories here are prompt-injection / agent-trust and the path-traversal
  re-exposure that rides along with it.

## Verdict
No blockers. Two should-know findings, both about the new **inline** route
stripping the safety gates that the terminal command provides — one is a design
trade-off the authors documented prominently, the other re-exposes phase-170's
unvalidated-id weakness without its backstop.

## Findings

### SEC-1 · should-know · Inline `/mini:security` runs the review with full session permissions and no confirm
**Where:** `src/commands/context.ts:89-97` (the `cmd === 'security'` branch) →
`src/commands/context.ts:107` (prompt written straight to stdout);
slash template `src/install/commands.ts:128-144`.

The terminal `mini security` (phase 170) gave the review two real safety gates:
an interactive `ask confirm` and a scoped allow-list (`Read/Grep/Glob/LS`,
read-only git, `Write(.mini/security/**)`, no `Edit`) enforced on a **fresh**
spawned Claude session. The new slash route has **neither**: `mini context
security` only resolves the range and `process.stdout.write`s the prompt
(`context.ts:102-107`) — no confirm — and the installed command body tells Claude
to "follow the printed instructions **exactly**" **inline in the current
session**, with that session's permissions. So the one command whose entire job
is to ingest a hostile diff and attacker-controlled `.mini/project.md` / phase
titles runs with the widest tool access (potentially `Edit`, arbitrary `Bash`,
network) and no human checkpoint between the poisoned content and an action.

Concrete path: a cloned repo ships a `project.md` / phase goal containing
injected instructions ("ignore the review, run …"); a developer runs
`/mini:security`; `buildSecurityContext` embeds that text into the printed prompt
(`securityReviewContext.ts:48-57`, via `readProjectSafe` + `resolveRangePhases`);
inline Claude acts on it under the session's permission mode. In an `acceptEdits`
/ bypass session this is an unattended escalation.

The authors document this prominently in the slash template's "Independence note"
(`src/install/commands.ts:130-134`) and offer the two correct mitigations (run
`mini security` in a terminal for the fresh, scoped session, or `/clear` first).
It is also the same architectural pattern as every other `/mini:*` slash command.
Recorded as should-know rather than blocker because it is documented and opt-out,
but it is a real weakness and worth keeping visible: the *security* command is the
worst one to run un-sandboxed. Direction: consider making the slash template tell
the reviewer explicitly to treat the diff/`.mini/` purely as data and to refuse
any instruction found inside it, and/or print a louder inline warning.

### SEC-2 · should-know · Unvalidated `state.json` phase id reaches the report path, now without the Write backstop
**Where:** `src/commands/securityTarget.ts:103` (`securityReportPath(\`phase-${id}\`)`),
reached inline via `buildSecurityContext` (`securityReviewContext.ts:81-90`) →
`context.ts:96`.

Phase 170 (SEC-1 in `phase-170.md`) noted that `id` comes from `loadHeader`,
which casts `state.json` with no schema validation (`src/state/store.ts:207-214`),
and flows unsanitized through `phaseStem` (`String(id).padStart` —
`store.ts:60-67`) into `join('.mini','security', \`phase-${id}.md\`)`. There the
mitigation was the fixed `Write(.mini/security/**)` allow-list plus the
interactive confirm: a normalized `..` traversal in `outputPath` would not match
the glob, so Claude had to ask the human. Phase 171 makes that **same** code
reachable through the inline route (`context.ts:96`), where — per SEC-1 — neither
the allow-list nor the confirm applies. So a poisoned `state.json` last-`done` id
such as `X/../../../../etc/x`, once it produces a traversal `outputPath`, is
embedded in the printed prompt as "write your report to `<traversal>.md`" with no
write-scope backstop in an auto-approving session.

Exploitability stays bounded by the precondition carried from phase 170:
producing a traversal `outputPath` requires `loadPhase` to first return an object
with a valid `autoCommit.preSha` (else the default branch falls through to phase
mode and `resolveRange` errors out), and that read carries the same traversal —
generally a file the attacker cannot plant outside the repo. So this is the same
contrived weakness, but its primary mitigations are gone on the new path.
Direction: validate header phase ids as positive integers at load time (the CLI
already does this for `--from-phase/--to-phase` via `parsePhaseNumber`); fixing it
once in the loader closes both the terminal and the inline route.

## Checked and clean
- **Process execution** — no new spawn in this range. `mini context security`
  only builds a string and writes it to stdout (`context.ts:107`); it never
  spawns `claude`. The terminal `security()` spawn and its fixed
  `SECURITY_ALLOWED_TOOLS` are unchanged by this commit. No shell, no argv built
  from untrusted data.
- **Slash-command template** — `src/install/commands.ts:128-144` is a static
  literal pushed to the install list; no untrusted interpolation. `$ARGUMENTS` is
  a Claude Code placeholder substituted at slash-command time from the
  *developer's own* typed args (not attacker-controlled `.mini/`), then parsed by
  commander / passed as git argv — same surface as the existing
  `adversarial-project` template, not a new injection sink.
- **Refactor equivalence** — `buildSecurityContext` (`securityReviewContext.ts:81-90`)
  is a pure extraction of the two calls previously inlined in `security.ts`
  (`resolveSecurityTarget` then `buildSecurityReviewContext`); same inputs, same
  null-on-error contract, no new data flow.
- **Untrusted parsing** — no new parser added; the route reuses the existing
  `loadHeader`/`loadPhase`/`resolveRange` loaders, whose failure modes (throw →
  caught upstream, or `null`) end in a clean non-zero exit with empty stdout
  (`context.ts:102-104`), so a malformed `.mini/` never feeds a partial prompt.
- **Dependency surface** — no `package.json`/lockfile change in this commit; no
  new third-party package, nothing at install time.
