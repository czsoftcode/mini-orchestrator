## src/commands/status.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { describeModels, isOrphanedDoing, nextActionHint, openVerifyCount, runReportSummaryLines } from "./status.js"
- type { RunReportSummary } from "../state/runReport.js"
- type { Phase, ProjectState } from "../state/types.js"
