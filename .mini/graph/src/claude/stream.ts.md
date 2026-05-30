## src/claude/stream.ts

Imports:
- { spawn } from "node:child_process"
- { describeSpawnError } from "./spawnError.js"
- type { PermissionMode } from "./work.js"

Exports:
- interface StreamOptions
- interface StreamUsage
- interface StreamResult
- type StreamEvent
- interface SystemInitEvent
- interface AssistantEvent
- interface UserEvent
- interface ResultEvent
- interface UnknownEvent
- interface ToolUse
- interface ToolResult
- type RawEnvelope
- function parseStreamEvent(line: string): StreamEvent | null
- function createLineBuffer(onLine: (line: string) => void): { push: (chunk: string) => void; flush: () => void; }
- function streamWithClaude(prompt: string, opts: StreamOptions): Promise<StreamResult>
