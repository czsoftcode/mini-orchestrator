## src/state/runReport.ts

Imports:
- { access, mkdir, readFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- const RUN_DIR @L12
- type RunStepStatus @L25
- type RunVerdict @L34
- interface RunReportStep @L36-40
- interface RunReportVerifyItem @L47-52
- interface RunReport @L54-66
- function runReportPath(cwd: string, phaseId: number): string @L68-70
- function previousRunReportPath(cwd: string, phaseId: number): string @L79-81
- function ensureRunDir(cwd: string): Promise<void> @L89-91
- function runReportExists(cwd: string, phaseId: number): Promise<boolean> @L93-100
- class RunReportParseError @L107-112
- interface ParseRunReportContext @L117-127
- function parseRunReport(text: string, ctx: ParseRunReportContext): RunReport @L133-225
- function readRunReport(cwd: string, ctx: ParseRunReportContext): Promise<RunReport | null> @L275-290
- interface RunReportSummary @L298-305
- function summarizeRunReportText(text: string): RunReportSummary @L311-331
- function readRunReportSummary(cwd: string, phaseId: number): Promise<RunReportSummary | null> @L337-352
