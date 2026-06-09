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
whole files. It supports TS, PHP, Rust, Python, Go, Java, C#, Kotlin, Swift,
Ruby and C/C++, and respects `.gitignore`. It changes **no** phase state — the graph is a
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

## Incremental update (`--file`)

A full `mini map` remaps the whole tree; `--file` touches **only one node** (its
graph file plus its `graph.json` record). Because graph nodes are purely per-file
with no back edges, the incremental result is **identical** to a full rebuild of
that file — just much faster. Details:

- When `graph.json` does not exist yet, `--file` falls back to a full build.
- Non-mappable extensions and ignored directories (`node_modules`, `dist`, …) are
  a no-op.
- When a source file has disappeared in the meantime, its node is **removed**.

## Auto-update after an edit (hook)

For **autonomous mode** it pays off to keep the graph fresh after every edit. A
PostToolUse hook does that — after every `Edit`/`Write` it remaps just the
affected file (a local operation, no tokens). Add this to the target project's
`.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          { "type": "command", "command": "mini map --hook >/dev/null 2>&1 || true" }
        ]
      }
    ]
  }
}
```

`mini map --hook` reads the edited file path from the hook JSON on stdin itself
(no dependency on `jq`); the `>/dev/null 2>&1 || true` keeps the hook quiet and
non-blocking even when `mini` is not installed. The hook does **not** catch file
deletions and renames (done via the shell) — for those, occasionally run a full
`mini map` as a reconciliation.

## Notes

- `--hook` is meant for an editor/agent hook, not for running by hand; with no
  file path on stdin it silently does nothing (it does not trigger a full
  rebuild).
- Generated graph files are git-ignored — regenerate them with this command.

## Related

- [`/mini:map`](../interactive/map.md) — interactive variant
- [`mini audit`](audit.md) — prose codebase overview (complementary)
- [`mini init`](init.md) — run map after init in a brownfield repo
