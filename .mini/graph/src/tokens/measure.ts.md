## src/tokens/measure.ts

Imports:
- { buildAutoPhasePrompt } from "../prompts/autoPhase.js"
- { buildDiscussPhasePrompt } from "../prompts/discussPhase.js"
- { buildDoPhasePrompt } from "../prompts/doPhase.js"
- { buildDoneSessionPrompt, buildNextSessionPrompt, buildPlanSessionPrompt } from "../prompts/sessionContext.js"
- { buildWriteMemoryPrompt } from "../prompts/writeMemory.js"
- type { Phase, ProjectState, Step } from "../state/types.js"

Exports:
- const COMMAND_IDS
- type CommandId
- function estimateTokens(text: string): number
- interface ContextBlock
- interface BlockTokens
- interface CommandMeasurement
- interface PhaseLite
- interface VerifyItem
- interface RealInputs
- function measureAll(input: RealInputs): CommandMeasurement[]
- function rankMeasurements(measurements: CommandMeasurement[]): CommandMeasurement[]
- function renderReportMarkdown(ranked: CommandMeasurement[]): string
- function renderConsole(ranked: CommandMeasurement[]): string
