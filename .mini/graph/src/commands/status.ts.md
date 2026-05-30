## src/commands/status.ts

Imports:
- { default } from "picocolors"
- { MODEL_SCOPES } from "../state/models.js"
- { readRunReportSummary, RunReportSummary, RunReportVerifyItem, RunVerdict } from "../state/runReport.js"
- { exists, load, readProject } from "../state/store.js"
- type { Phase, PhaseStatus, ProjectState, StepStatus } from "../state/types.js"
- { log } from "../ui/log.js"

Exports:
- function status(): Promise<void>
- function describeModels(state: ProjectState): string
- function openVerifyCount(verify: readonly RunReportVerifyItem[], phase: Phase): number
- function runReportSummaryLines(summary: RunReportSummary, phase: Phase): string[]
- function isOrphanedDoing(phase: Phase, phases: readonly Phase[]): boolean
- function nextActionHint(state: ProjectState): string
