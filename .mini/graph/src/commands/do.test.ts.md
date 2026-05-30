## src/commands/do.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { mkdtemp, rm } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { load, save, writeProject } from "../state/store.js"
- type { ProjectState } from "../state/types.js"
