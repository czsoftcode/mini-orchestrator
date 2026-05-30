## src/state/store.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { exists, hasPrev, load, loadFullState, loadHeader, loadPhase, loadPrev, newState, phaseFileName, phasesDir, restorePrev, save, saveHeader, savePhase, statePath, statePrevPath } from "./store.js"
- type { Phase, ProjectState, StateHeader } from "./types.js"
