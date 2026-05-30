## src/state/discussNotes.ts

Imports:
- { readFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- const DISCUSS_DIR
- function discussNotesPath(cwd: string, phaseId: number): string
- function readDiscussNotes(cwd: string, phaseId: number): Promise<string | null>
