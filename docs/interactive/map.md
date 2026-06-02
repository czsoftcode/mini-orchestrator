# `/mini:map`

> Regenerate the project graph (supplementary).

**CLI variant:** [`mini map`](../non-interactive/map.md) — incl. the `--file` and
`--hook` incremental forms.

## What it does

`/mini:map` runs `mini map` to regenerate the project graph (`.mini/graph/` plus
the index `.mini/graph.json`) from the source files — exports, imports and
signatures that later sessions use to navigate the code cheaply. It changes
**no** phase state; the graph is a pure derivation of the sources.

## In a session

1. Claude runs `mini map` in Bash.
2. It relays the result (the index path and the number of mapped files).

## Example

```text
You:    /mini:map
Claude: [mini map] Mapped 84 files → .mini/graph.json.
```

## Notes

- Typically run right after [`/mini:init`](init.md) in a brownfield repo, before
  [`/mini:audit`](audit.md).

## Related

- [`mini map`](../non-interactive/map.md) — CLI variant
- [`/mini:audit`](audit.md) — prose codebase overview (complementary)
