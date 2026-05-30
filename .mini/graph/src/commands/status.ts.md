## src/commands/status.ts

Imports:
- { default } from "picocolors"
- { MODEL_SCOPES } from "../state/models.js"
- { readRunReportSummary, RunReportSummary, RunReportVerifyItem, RunVerdict } from "../state/runReport.js"
- { exists, load, readProject } from "../state/store.js"
- type { Phase, PhaseStatus, ProjectState, StepStatus } from "../state/types.js"
- { log } from "../ui/log.js"

Exports:
- function status(): Promise<void> @L36-86
- function describeModels(state: ProjectState): string @L127-136
- function openVerifyCount(verify: readonly RunReportVerifyItem[], phase: Phase): number @L142-145
- function runReportSummaryLines(summary: RunReportSummary, phase: Phase): string[] @L158-178
- function isOrphanedDoing(phase: Phase, phases: readonly Phase[]): boolean @L189-200
- function nextActionHint(state: ProjectState): string @L210-229
