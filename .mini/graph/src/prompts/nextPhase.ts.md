## src/prompts/nextPhase.ts

Imports:
- type { PhaseStatus, ProjectState } from "../state/types.js"
- { GRAPH_USAGE_HINT } from "./graphHint.js"

Exports:
- interface BuildNextPhaseOptions @L12-16
- function buildNextPhasePrompt(projectMd: string, state: ProjectState, optionsOrHint?: BuildNextPhaseOptions | string): string @L18-66
