# File existence, not a flag, is the source of truth

## Decision
A phase "has a decision record" iff the file `.mini/decisions/phase-<id>.md`
exists. There is no `decision: true` flag in `state.json` or in the phase file.
Reading is `readDecision()` (raw markdown or `null`); the overview marker (a
follow-up) will derive the set of phases-with-ADR from one `readdir` of
`.mini/decisions/`.

## Why
The first instinct was to mirror the file with a boolean flag in the phase JSON
so the overview could mark phases without touching the folder. Rejected: a flag
duplicates information the filesystem already holds, creating a second source of
truth that can drift (e.g. `mini undo` deletes the file but leaves the flag, or
vice versa) and would need a `doctor` check just to police the sync. With
existence-as-truth there is nothing to keep consistent — `undo` just
removes/restores the file, and the overview stays cheap (one `readdir`, no
per-phase JSON reads). The mild cost (a directory listing instead of a boolean
lookup) is negligible and worth the simpler invariant.

This mirrors how `.mini/run/` already works (a report exists or it doesn't) and
follows DocFlow's `decisions/` folder idea while staying far leaner — no
taxonomy, no independent `NNNN-` numbering, one file bound to the phase id.
