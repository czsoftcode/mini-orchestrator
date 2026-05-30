## src/commands/migrate.ts

Imports:
- { readFile } from "node:fs/promises"
- { exists, phasesDir, saveHeader, savePhase, SCHEMA_VERSION, statePath } from "../state/store.js"
- type { Phase, PhaseSummary, ProjectModels, StateHeader } from "../state/types.js"
- { log } from "../ui/log.js"
- type { StepOutcome } from "./types.js"

Exports:
- function migrate(cwd: string): Promise<StepOutcome> @L37-79
