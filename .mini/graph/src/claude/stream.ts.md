## src/claude/stream.ts

Imports:
- { spawn } from "node:child_process"
- { describeSpawnError } from "./spawnError.js"
- type { PermissionMode } from "./work.js"

Exports:
- interface StreamOptions @L6-14
- interface StreamUsage @L16-21
- interface StreamResult @L23-32
- type StreamEvent @L34-39
- interface SystemInitEvent @L41-48
- interface AssistantEvent @L50-56
- interface UserEvent @L58-63
- interface ResultEvent @L65-75
- interface UnknownEvent @L77-81
- interface ToolUse @L83-87
- interface ToolResult @L89-93
- type RawEnvelope @L95
- function parseStreamEvent(line: string): StreamEvent | null @L101-108
- function createLineBuffer(onLine: (line: string) => void): { push: (chunk: string) => void; flush: () => void; } @L229-251
- function streamWithClaude(prompt: string, opts: StreamOptions): Promise<StreamResult> @L253-335
