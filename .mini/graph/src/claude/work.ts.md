## src/claude/work.ts

Imports:
- { spawn } from "node:child_process"
- { describeSpawnError } from "./spawnError.js"

Exports:
- type PermissionMode
- interface WorkOptions
- interface WorkResult
- function workWithClaude(prompt: string, opts: WorkOptions): Promise<WorkResult>
