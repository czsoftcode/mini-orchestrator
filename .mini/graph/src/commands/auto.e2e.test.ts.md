## src/commands/auto.e2e.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { delimiter, join } from "node:path"
- { load, save, writeProject } from "../state/store.js"
- type { ProjectState } from "../state/types.js"
