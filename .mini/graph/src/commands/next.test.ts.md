## src/commands/next.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { mkdtemp, rm } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { next, parseSuggestion } from "./next.js"
- { askClaude } from "../claude/ask.js"
- { load, save, writeProject } from "../state/store.js"
- type { Phase, ProjectState } from "../state/types.js"
