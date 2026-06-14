# Findings keyed by phase, not by commit

## Decision
Adversarial findings are stored and indexed by the **phase** they are about (`.mini/findings/phase-{id}.md`), keeping mini's phase-centric model. A commit SHA is deliberately NOT the primary key; recording the reviewed HEAD SHA as optional metadata is left as a future additive refinement.

## Why
Binding findings to commits was weighed and rejected for three concrete reasons. (1) Timing: adversarial runs between `do` and `done`, when the phase's changes are still uncommitted in the working tree — there is no commit to bind to yet, only the parent (the previous phase). The phase id, by contrast, exists and is correct at review time. (2) Stability: mini rewrites history (`mini undo` soft-resets the phase commit; amend/rebase/squash), so a SHA-keyed finding easily becomes an unrecoverable orphan, while a phase id survives undo and renumbering. (3) Consistency and consumption: every other store (state, run, memory, decisions) is keyed by `phaseStem`, and the whole point of the store — feeding later phases — is a phase-shaped query ("what's open from phase 154"), not a commit-shaped one. Commit-as-key would only fit a general PR/commit review tool decoupled from mini's loop, which is out of scope.
