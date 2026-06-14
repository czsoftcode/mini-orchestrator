# Phase 158 — Link phase to finding

## Intent
Give `discuss` and `plan` a **durable** way to know which open adversarial
finding the current phase is meant to fix, so they can read that finding's full
detail from disk — even in a fresh session days later, not relying on the chat
context left behind by `next`.

This reshapes the original idea ("inject an open-findings block into plan and
do"). The problem found during discussion: there is no link between a phase and
the finding it addresses (no `--from-finding`), and a finding is bound to its
**origin** phase (where the review found it), not to the fix phase. Filtering
"findings of the current phase" would therefore show nothing for a freshly
created fix phase. And relying on "findings are already in the session context
from `next`" breaks mini's core promise (resume after days in a new session).

Solution: a stored link plus on-demand full read of the linked finding.

## Key decisions
- **New flag `--from-finding <id>` on `mini next --apply`.** Records on the
  phase which finding it addresses (e.g. a field like `fromFinding: "155-1"` in
  the phase file). Mirror the existing `--from-todo` plumbing for parsing/store.
- **Different semantics from `--from-todo`.** `--from-todo` ticks its source
  item immediately. `--from-finding` must **NOT** resolve/close the finding —
  the finding stays `open` until the fix is actually done and verified
  (`done`/`verify`). It only records the link.
- **Single id per phase.** One phase = one fix. No multi-finding support yet
  (YAGNI); extend later if needed.
- **`next` prompt instructs the proposer** to pass `--from-finding <id>` when a
  phase is born from an open finding (parallel to the existing `--from-todo`
  guidance in the next prompt's findings block).
- **`discuss` and `plan` consume the link.** In `context.ts`, when the current
  phase has `fromFinding`, load that finding's full entry from
  `.mini/findings/phase-{originId}.md` and inject its detail (title, body,
  where, severity) into the prompt. The body is the actionable "what breaks and
  how" detail that the `next` headline list does not carry.
- **`do` is unchanged.** It executes the plan (which already encodes the fix)
  and usually runs in the same session as `plan`.

## Watch out for
- **Proposer may forget the flag.** If `next` doesn't pass `--from-finding`, the
  link is missing and discuss/plan have nothing to read. This relies on the
  model following the prompt instruction (same inherent weakness as
  `--from-todo`); it is not a bug to "fix", but the next prompt wording must be
  clear.
- **Invalid / stale id.** `--from-finding` on a non-existent finding id must
  fail with a clear error at save time. Conversely, when discuss/plan read a
  linked finding that has since been resolved or whose file was removed, they
  must degrade to a soft note ("finding not found / already resolved"), never
  crash or print a misleading "no phase" message.
- **Finding id format** is `{originPhaseId}-{n}` (e.g. `155-1`); the origin
  phase id is the prefix, which is how the file `.mini/findings/phase-155.md`
  is located. Parse defensively.
- **Token cost.** Inlining the full finding body grows the discuss/plan prompt,
  but only when a link exists; no link → no block. Keep the rendered block lean
  (one finding, its fields, its body).
- **Reuse, don't duplicate.** `listFindings` / the findings store already parse
  entries and tolerate a missing dir; reuse that path rather than re-reading
  files ad hoc. The `next` findings block in `sessionContext.ts` is the
  rendering precedent to follow.
