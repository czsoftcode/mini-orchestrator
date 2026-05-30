## src/prompts/sessionContext.ts

Imports:
- type { Phase, PhaseStatus, ProjectState, Step, StepStatus } from "../state/types.js"
- { GRAPH_USAGE_HINT } from "./graphHint.js"

Exports:
- interface NextSessionOptions
- function buildNextSessionPrompt(projectMd: string, state: ProjectState, options: NextSessionOptions): string
- function buildPlanSessionPrompt(projectMd: string, phase: Phase, discussNotes?: string | null): string
- interface DoneSessionInput
- function buildDoneSessionPrompt(input: DoneSessionInput): string
