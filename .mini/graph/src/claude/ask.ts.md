## src/claude/ask.ts

Imports:
- { spawn } from "node:child_process"
- { describeSpawnError } from "./spawnError.js"
- type { PermissionMode } from "./work.js"

Exports:
- interface AskOptions @L5-12
- interface AskUsage @L14-19
- interface AskResult @L21-26
- function askClaude(prompt: string, opts: AskOptions): Promise<AskResult> @L44-127
