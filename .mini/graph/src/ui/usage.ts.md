## src/ui/usage.ts

Imports:
- { default } from "picocolors"
- type { AskResult } from "../claude/ask.js"
- type { StreamResult } from "../claude/stream.js"
- { log } from "./log.js"

Exports:
- function logUsage(response: AskResult): void @L7-24
- function logStreamSummary(result: StreamResult): void @L32-61
