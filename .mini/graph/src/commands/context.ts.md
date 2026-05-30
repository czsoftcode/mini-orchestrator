## src/commands/context.ts

Imports:
- { readFile } from "node:fs/promises"
- { join } from "node:path"
- { buildAutoPhasePrompt } from "../prompts/autoPhase.js"
- { buildDiscussPhasePrompt } from "../prompts/discussPhase.js"
- { buildDoneSessionPrompt, buildNextSessionPrompt, buildPlanSessionPrompt } from "../prompts/sessionContext.js"
- { LAST_MEMORY_FILE } from "../prompts/writeMemory.js"
- { readDiscussNotes } from "../state/discussNotes.js"
- { RunReportParseError, parseRunReport, runReportExists, runReportPath } from "../state/runReport.js"
- { exists, loadHeader, loadPhase, readProject } from "../state/store.js"
- type { Phase, ProjectState, StateHeader } from "../state/types.js"
- { log } from "../ui/log.js"

Exports:
- const CONTEXT_COMMANDS @L23
- type ContextCommand @L24
- function isContextCommand(value: string): value is ContextCommand @L26-28
- function context(cmd: string, extraArgs: string[]): Promise<void> @L40-74
