## src/state/discussNotes.ts

Imports:
- { readFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- const DISCUSS_DIR @L4
- function discussNotesPath(cwd: string, phaseId: number): string @L6-8
- function readDiscussNotes(cwd: string, phaseId: number): Promise<string | null> @L10-19
