# `mini map`

> Regenerates the machine-readable project map for the agent.

**Interactive variant:** [`/mini:map`](../interactive/map.md) — the slash command
runs this and relays the result.

## Synopsis

```bash
mini map                       # full rebuild
mini map --file src/foo.ts     # incrementally remap one file (repeatable)
mini map --hook                # remap the edited file from hook JSON on stdin
```

## Description

`mini map` builds the project graph into `.mini/graph/` plus the index
`.mini/graph.json`: for each source file its exports, imports and signatures.
Later sessions read this map to navigate the code cheaply instead of reading
whole files. It supports TS, PHP, Rust, Python, Go, Java, C#, Kotlin, Swift and
Ruby, and respects `.gitignore`. It changes **no** phase state — the graph is a
pure derivation of the sources.

## Options

| Flag | Description |
| --- | --- |
| `--file <path>` | Incrementally remap only the given file (its node + index record). Repeatable. Without it, a full rebuild runs. |
| `--hook` | Read the edited file path from the hook JSON on stdin (PostToolUse Edit/Write) and remap it incrementally. Silently no-ops when the payload has no path. |

## Examples

```bash
$ mini map
[ok] Mapped 84 files → .mini/graph.json

$ mini map --file src/cli.ts --file src/version.ts
[ok] Remapped 2 files.
```

Wire `--hook` into a PostToolUse hook so the map stays fresh as you edit:

```json
{ "command": "mini map --hook" }
```

## Notes

- `--hook` is meant for an editor/agent hook, not for running by hand; with no
  file path on stdin it silently does nothing (it does not trigger a full
  rebuild).
- Generated graph files are git-ignored — regenerate them with this command.

## Related

- [`/mini:map`](../interactive/map.md) — interactive variant
- [`mini audit`](audit.md) — prose codebase overview (complementary)
- [`mini init`](init.md) — run map after init in a brownfield repo
