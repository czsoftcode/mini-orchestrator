## src/commands/done.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { advanceToNextPhase, applyDone, buildPhaseCommitMessage, done } from "./done.js"
- { ensureRunDir, runReportPath } from "../state/runReport.js"
- { load, save } from "../state/store.js"
- type { Phase, ProjectState } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { isInteractive } from "../ui/interactive.js"
- { commitAll, hasChanges, headSha, isGitRepo, push } from "../git.js"
- { writePhaseMemory } from "./writeMemory.js"
