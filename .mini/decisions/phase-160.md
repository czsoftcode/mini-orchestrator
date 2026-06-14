# Verify findings share the adversarial findings store, tagged by source

## Decision
Verify (human UI/UX review) findings are recorded into the same durable `.mini/findings/` store as adversarial findings, via `mini findings add --source verify`. Each finding carries a `source` field (`adversarial` | `verify`); a missing `**Source:**` line defaults to `adversarial` for backward compatibility.

## Why
Two alternatives were rejected. (1) A report-only fix — just make verify stop writing into a corrupt/missing run report — was rejected because it doesn't mirror adversarial: findings would still be buried in a closed phase's report and never surface in `next`. (2) Sharing the store without a `source` field was rejected because it loses the origin: code-review findings and UX findings would be indistinguishable in one file and in `next`. Sharing one store keeps the whole lifecycle (surface in `next`, `--from-finding`, auto-resolve on `done`) already built for adversarial, instead of duplicating a parallel store; the `source` field is the minimal cost to keep the two kinds distinguishable. The trade-off accepted: a code-flavored severity vocabulary (blocker/should-know/nit) now also tags UX findings, and a forgotten `--source` flag silently mislabels a verify finding as adversarial.
