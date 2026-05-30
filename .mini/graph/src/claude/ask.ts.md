## src/claude/ask.ts

Imports:
- { spawn } from "node:child_process"
- { describeSpawnError } from "./spawnError.js"
- type { PermissionMode } from "./work.js"

Exports:
- interface AskOptions
- interface AskUsage
- interface AskResult
- function askClaude(prompt: string, opts: AskOptions): Promise<AskResult>
