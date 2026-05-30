## src/commands/model.ts

Imports:
- { MODEL_SCOPES, SCOPE_LABELS, ModelScope } from "../state/models.js"
- { exists, load, save } from "../state/store.js"
- type { ProjectState } from "../state/types.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"

Exports:
- function model(arg1?: string, arg2?: string): Promise<void> @L20-66
