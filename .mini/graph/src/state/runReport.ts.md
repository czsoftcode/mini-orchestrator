## src/state/runReport.ts

Imports:
- { access, mkdir, readFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- const RUN_DIR
- type RunStepStatus
- type RunVerdict
- interface RunReportStep
- interface RunReportVerifyItem
- interface RunReport
- function runReportPath(cwd: string, phaseId: number): string
- function previousRunReportPath(cwd: string, phaseId: number): string
- function ensureRunDir(cwd: string): Promise<void>
- function runReportExists(cwd: string, phaseId: number): Promise<boolean>
- class RunReportParseError
- interface ParseRunReportContext
- function parseRunReport(text: string, ctx: ParseRunReportContext): RunReport
- function readRunReport(cwd: string, ctx: ParseRunReportContext): Promise<RunReport | null>
- interface RunReportSummary
- function summarizeRunReportText(text: string): RunReportSummary
- function readRunReportSummary(cwd: string, phaseId: number): Promise<RunReportSummary | null>
