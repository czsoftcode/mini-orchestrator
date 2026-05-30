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
- function plan(opts: AutoOptions): Promise<StepOutcome>
- function applyPlanSteps(titles: string[], cwd: string): Promise<StepOutcome>
- function parseStepsFromStdin(text: string): string[]
- function parseSteps(text: string): string[]
