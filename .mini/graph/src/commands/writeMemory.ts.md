## src/commands/writeMemory.ts

Imports:
- { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises"
- { join } from "node:path"
- { askClaude } from "../claude/ask.js"
- { buildWriteMemoryPrompt, LAST_MEMORY_FILE, MEMORY_DIR } from "../prompts/writeMemory.js"
- { readProject } from "../state/store.js"
- type { Phase, ProjectState, StepStatus } from "../state/types.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"

Exports:
- function writePhaseMemory(phase: Phase, state: ProjectState, cwd: string, options: { hasAutoCommit: boolean; }): Promise<void> @L56-109
- function buildPhaseMemoryMarkdown(phase: Phase, discussContent: string, runContent: string): string @L115-157
- function summarizeMemoryForNext(md: string): string @L179-212
- function fsSafeTimestamp(date: Date): string @L376-378
