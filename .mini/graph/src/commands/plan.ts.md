## src/commands/plan.ts

Imports:
- { askClaude } from "../claude/ask.js"
- { buildPlanPhasePrompt } from "../prompts/planPhase.js"
- { readDiscussNotes } from "../state/discussNotes.js"
- { resolveModel } from "../state/models.js"
- { exists, load, readProject, save } from "../state/store.js"
- type { Step } from "../state/types.js"
- { ask, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"
- type { AutoOptions, StepOutcome } from "./types.js"

Exports:
- function plan(opts: AutoOptions): Promise<StepOutcome> @L12-137
- function applyPlanSteps(parsed: ParsedStep[], cwd: string): Promise<StepOutcome> @L144-194
- interface ParsedStep @L201-204
- function parseStepsFromStdin(text: string): ParsedStep[] @L215-245
- function parseSteps(text: string): string[] @L247-259
