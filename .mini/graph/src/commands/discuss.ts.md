## src/commands/discuss.ts

Imports:
- { access, mkdir } from "node:fs/promises"
- { join } from "node:path"
- { workWithClaude } from "../claude/work.js"
- { buildDiscussPhasePrompt } from "../prompts/discussPhase.js"
- { exists, load, readProject, save } from "../state/store.js"
- type { Phase } from "../state/types.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"
- type { StepOutcome } from "./types.js"

Exports:
- function discuss(): Promise<StepOutcome>
