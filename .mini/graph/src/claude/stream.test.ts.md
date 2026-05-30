## src/claude/stream.test.ts

Imports:
- { EventEmitter } from "node:events"
- { beforeEach, describe, expect, it, vi } from "vitest"
- { createLineBuffer, parseStreamEvent, streamWithClaude, AssistantEvent, ResultEvent, SystemInitEvent, UnknownEvent, UserEvent } from "./stream.js"
