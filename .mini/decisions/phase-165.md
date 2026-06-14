# Range flags on the `context` command, not hand-parsed from args

## Decision
The adversarial-project range flags (--from-phase/--to-phase, --from/--to) are declared as real commander options on the generic `mini context <cmd>` command and threaded into context() as a RangeInput, even though only one of the nine context sub-commands uses them.

## Why
The alternative was allowUnknownOption() on `context` plus hand-parsing the flags out of the variadic args[] inside context.ts. Rejected because: (1) without declared options commander rejects the unknown flags before the action runs, so passthrough would need extra config; (2) hand-parsing would re-implement parsePhaseNumber's validation and the phase/ref mutual-exclusion that resolveRange already enforces, duplicating logic that the interactive adversarial-project command gets for free from commander. The cost is four flags that are no-ops for the other eight sub-commands — documented in the command description and --help as applying only to adversarial-project.
