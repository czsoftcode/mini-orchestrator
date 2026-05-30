## src/tokens/measure.ts

Imports:
- { buildAutoPhasePrompt } from "../prompts/autoPhase.js"
- { buildDiscussPhasePrompt } from "../prompts/discussPhase.js"
- { buildDoneSessionPrompt, buildNextSessionPrompt, buildPlanSessionPrompt } from "../prompts/sessionContext.js"
- { buildWriteMemoryPrompt } from "../prompts/writeMemory.js"
- type { Phase, ProjectState, Step } from "../state/types.js"

Exports:
- const COMMAND_IDS @L33-41
- type CommandId @L42
- function estimateTokens(text: string): number @L45-47
- interface ContextBlock @L50-53
- interface BlockTokens @L55-58
- interface CommandMeasurement @L60-70
- interface PhaseLite @L99-103
- interface VerifyItem @L231-234
- interface RealInputs @L280-292
- function measureAll(input: RealInputs): CommandMeasurement[] @L295-326
- function rankMeasurements(measurements: CommandMeasurement[]): CommandMeasurement[] @L329-333
- function renderReportMarkdown(ranked: CommandMeasurement[]): string @L352-373
- function renderConsole(ranked: CommandMeasurement[]): string @L376-387
