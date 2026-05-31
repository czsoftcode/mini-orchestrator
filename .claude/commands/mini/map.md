---
description: mini — regenerate the project graph (supplementary)
---

This is the **map** step of the mini workflow, run directly in Claude Code.

Run in Bash `mini map` — it regenerates the project graph (`.mini/graph/` + the index `.mini/graph.json`) from the source files. Relay the result (the index path and the number of mapped files) from the output to the user in the chat. It does not change the phase state in `.mini/state.json` in any way — the graph is just a derivation from the source files.
