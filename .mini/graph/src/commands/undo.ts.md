## src/commands/undo.ts

Imports:
- { headSha, isCleanWorkingTree, isGitRepo, softResetTo } from "../git.js"
- { exists, hasPrev, load, loadPrev, restorePrev } from "../state/store.js"
- type { PhaseAutoCommit, ProjectState } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { log } from "../ui/log.js"

Exports:
- function undo(): Promise<void> @L22-82
