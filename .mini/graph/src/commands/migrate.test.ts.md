## src/commands/migrate.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { migrate } from "./migrate.js"
- { load, loadHeader, loadPhase, phaseFileName, phasesDir, statePath } from "../state/store.js"
- type { StateHeader } from "../state/types.js"
