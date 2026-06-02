# `mini audit`

> Scans the existing code into a `.mini/codebase.md` overview.

**Interactive variant:** [`/mini:audit`](../interactive/audit.md) — the slash
command runs this and summarizes the result.

## Synopsis

```bash
mini audit
```

## Description

`mini audit` goes through the existing code and creates or updates
`.mini/codebase.md` — a prose overview of the codebase for later Claude
sessions. It is typically run right after [`mini init`](init.md) in a brownfield
repo (optionally after [`mini map`](map.md)). It changes **no** phase state and
takes no flags.

## Example

```bash
$ mini audit
[ok] Codebase overview written to .mini/codebase.md
```

## Notes

- Complementary to [`mini map`](map.md): `map` is the machine-readable graph,
  `audit` is the human-readable prose overview.
- Re-running updates `.mini/codebase.md` to reflect the current code.

## Related

- [`/mini:audit`](../interactive/audit.md) — interactive variant
- [`mini map`](map.md) — machine-readable graph
- [`mini init`](init.md) — brownfield setup that precedes audit
