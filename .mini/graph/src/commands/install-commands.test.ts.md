## src/commands/install-commands.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { COMMANDS_DIR, installCommands } from "./install-commands.js"
