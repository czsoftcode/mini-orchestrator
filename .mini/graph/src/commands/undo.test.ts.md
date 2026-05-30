## src/commands/undo.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { mkdtemp, rm } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { save } from "../state/store.js"
- type { PhaseAutoCommit, ProjectState } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { headSha, isCleanWorkingTree, isGitRepo, softResetTo } from "../git.js"
