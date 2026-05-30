## src/prompts/nextPhase.ts

Imports:
- type { PhaseStatus, ProjectState } from "../state/types.js"

Exports:
- interface BuildNextPhaseOptions
- function buildNextPhasePrompt(projectMd: string, state: ProjectState, optionsOrHint?: BuildNextPhaseOptions | string): string
