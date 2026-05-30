## src/commands/map.test.ts

Imports:
- { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { map } from "./map.js"
