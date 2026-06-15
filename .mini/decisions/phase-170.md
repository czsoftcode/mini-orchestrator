# Security default ends at HEAD, not via shared range.ts

## Decision
For `mini security` with no flags (reviewing the last `done` phase), the range end is derived **locally as HEAD** in securityTarget.ts (input `{ from: preSha, to: HEAD }`), instead of going through resolveRange's phase mode. The shared range.ts was left untouched.

## Why
resolveRange phase mode computes the range end as the **next** phase's preSha. For the last `done` phase, that next phase is typically the in-progress one without a preSha, so the default would hard-fail every time the next phase is in progress (the normal state right after finishing a phase). The rejected alternative was to fix resolveRange globally (fall back to HEAD when the next phase exists without a preSha), but that function also feeds `mini adversarial-project`, and such a fallback could silently mask a genuinely missing preSha on a committed later phase (pulling unrelated phases into the range). The local fix keeps the semantically correct behaviour (the last done phase's commit IS HEAD) without risking the shared path. Cost: the genesis default with an uncommitted second phase (`emptyTree..HEAD` can't be expressed as a ref range) stays a narrow, documented limitation.
