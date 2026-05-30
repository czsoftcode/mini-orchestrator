## src/prompts/sessionContext.ts

Imports:
- type { Phase, PhaseStatus, ProjectState, Step, StepStatus } from "../state/types.js"
- { GRAPH_USAGE_HINT } from "./graphHint.js"

Exports:
- interface NextSessionOptions @L32-36
- function buildNextSessionPrompt(projectMd: string, state: ProjectState, options: NextSessionOptions): string @L42-92
- function buildPlanSessionPrompt(projectMd: string, phase: Phase, discussNotes?: string | null): string @L98-143
- interface DoneSessionInput @L145-153
- function buildDoneSessionPrompt(input: DoneSessionInput): string @L159-215
