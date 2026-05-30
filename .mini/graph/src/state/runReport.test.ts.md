## src/state/runReport.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { RUN_DIR, RunReportParseError, parseRunReport, readRunReport, readRunReportSummary, runReportPath, summarizeRunReportText } from "./runReport.js"
