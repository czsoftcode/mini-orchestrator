## scripts/measure-prompt-tokens.ts

Imports:
- { readFile, writeFile } from "node:fs/promises"
- { join } from "node:path"
- { LAST_MEMORY_FILE } from "../src/prompts/writeMemory.js"
- { readDiscussNotes } from "../src/state/discussNotes.js"
- { readRunReport } from "../src/state/runReport.js"
- { exists, loadHeader, loadPhase, readProject } from "../src/state/store.js"
- type { Phase, Step } from "../src/state/types.js"
- { PhaseLite, RealInputs, measureAll, rankMeasurements, renderConsole, renderReportMarkdown } from "../src/tokens/measure.js"
