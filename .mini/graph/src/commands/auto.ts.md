## src/commands/auto.ts

Imports:
- { rename } from "node:fs/promises"
- { join } from "node:path"
- type { AutoPhaseRetryContext } from "../prompts/autoPhase.js"
- { RUN_DIR, previousRunReportPath, runReportPath } from "../state/runReport.js"
- { exists, load } from "../state/store.js"
- { log } from "../ui/log.js"
- { doPhase } from "./do.js"
- { done } from "./done.js"
- { next } from "./next.js"
- { plan } from "./plan.js"
- type { AutoOptions } from "./types.js"

Exports:
- function auto(opts: AutoOptions): Promise<void>
