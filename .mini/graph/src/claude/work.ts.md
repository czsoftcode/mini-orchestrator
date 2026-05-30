## src/claude/work.ts

Imports:
- { spawn } from "node:child_process"
- { describeSpawnError } from "./spawnError.js"

Exports:
- type PermissionMode @L11
- interface WorkOptions @L13-19
- interface WorkResult @L21-23
- function workWithClaude(prompt: string, opts: WorkOptions): Promise<WorkResult> @L25-56
