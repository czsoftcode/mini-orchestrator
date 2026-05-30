## src/commands/context.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { context, isContextCommand, CONTEXT_COMMANDS } from "./context.js"
- { save } from "../state/store.js"
- { writeProject } from "../state/store.js"
- { ensureRunDir, runReportPath } from "../state/runReport.js"
- type { Phase, ProjectState } from "../state/types.js"
