## src/commands/map.ts

Imports:
- { buildGraph, GRAPH_DIR, GRAPH_INDEX, hasMappableProject } from "../graph/buildGraph.js"
- { exists } from "../state/store.js"
- { log } from "../ui/log.js"
- type { StepOutcome } from "./types.js"

Exports:
- function map(): Promise<StepOutcome> @L14-40
