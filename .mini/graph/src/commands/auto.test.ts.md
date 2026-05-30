## src/commands/auto.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { readFileSync } from "node:fs"
- { mkdtemp, rm, stat, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { ensureRunDir, runReportPath } from "../state/runReport.js"
- { load, phaseFileName, phasesDir, save, writeProject } from "../state/store.js"
- type { Phase, ProjectState, StateHeader } from "../state/types.js"
