## src/commands/next.ts

Imports:
- { readFile } from "node:fs/promises"
- { join } from "node:path"
- { askClaude } from "../claude/ask.js"
- { buildNextPhasePrompt } from "../prompts/nextPhase.js"
- { LAST_MEMORY_FILE } from "../prompts/writeMemory.js"
- { resolveModel } from "../state/models.js"
- { exists, load, readProject, save } from "../state/store.js"
- type { Phase, ProjectState } from "../state/types.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"
- type { AutoOptions, StepOutcome } from "./types.js"

Exports:
- interface ParsedSuggestion
- function next(opts: AutoOptions): Promise<StepOutcome>
- function applyNewPhase(title: string, goal: string, cwd: string): Promise<StepOutcome>
- function parseSuggestion(text: string): ParsedSuggestion | null
