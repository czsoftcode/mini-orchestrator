## src/commands/apply.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { access, mkdtemp, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { applyNewPhase } from "./next.js"
- { applyPlanSteps, parseStepsFromStdin } from "./plan.js"
- { applyDoStart } from "./do.js"
- { applyDone } from "./done.js"
- { load, save } from "../state/store.js"
- { ensureRunDir, runReportPath } from "../state/runReport.js"
- type { Phase, ProjectState } from "../state/types.js"
- { writePhaseMemory } from "./writeMemory.js"
