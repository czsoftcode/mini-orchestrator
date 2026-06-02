# `/mini:audit`

> Overview of the existing codebase into `.mini/codebase.md` (supplementary).

**CLI variant:** [`mini audit`](../non-interactive/audit.md).

## What it does

`/mini:audit` runs `mini audit`, which goes through the existing code and
creates/updates `.mini/codebase.md` — a prose overview of the codebase for later
sessions. It changes **no** phase state and is typically run right after
[`/mini:init`](init.md) in an existing project (optionally after
[`/mini:map`](map.md)).

## In a session

1. Claude runs `mini audit` in Bash.
2. It briefly summarizes the result.

## Example

```text
You:    /mini:audit
Claude: [mini audit] Codebase overview written to .mini/codebase.md.
```

## Notes

- Complementary to [`/mini:map`](map.md): `map` is the machine-readable graph,
  `audit` is the human-readable prose overview.

## Related

- [`mini audit`](../non-interactive/audit.md) — CLI variant
- [`/mini:map`](map.md) — machine-readable graph
- [`/mini:init`](init.md) — brownfield setup that precedes audit
