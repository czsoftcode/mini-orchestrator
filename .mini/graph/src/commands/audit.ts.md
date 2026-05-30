## src/commands/audit.ts

Imports:
- { askClaude } from "../claude/ask.js"
- { buildAuditCodebasePrompt, CODEBASE_FILE } from "../prompts/auditCodebase.js"
- { isBrownfield } from "../state/brownfield.js"
- { resolveModel } from "../state/models.js"
- { exists, readProject, load } from "../state/store.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"
- type { StepOutcome } from "./types.js"

Exports:
- function audit(): Promise<StepOutcome>
