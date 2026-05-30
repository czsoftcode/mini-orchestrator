## src/commands/done.ts

Imports:
- { readFile, writeFile } from "node:fs/promises"
- { join } from "node:path"
- { commitAll, createTag, hasChanges, headSha, isGitRepo, push, pushTag } from "../git.js"
- { buildGraph, GRAPH_DIR, hasMappableProject } from "../graph/buildGraph.js"
- { CHANGELOG_FILE, stampUnreleased, todayIso } from "../changelog.js"
- { bumpPackageVersion } from "../version.js"
- { RunReportParseError, readRunReport, runReportPath, RunReport, RunReportVerifyItem } from "../state/runReport.js"
- { exists, load, save } from "../state/store.js"
- type { Phase, ProjectState, Step } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { isInteractive } from "../ui/interactive.js"
- { log } from "../ui/log.js"
- type { AutoOptions, FinalizeOptions, StepOutcome } from "./types.js"
- { writePhaseMemory } from "./writeMemory.js"

Exports:
- function done(opts: AutoOptions): Promise<StepOutcome> @L22-142
- function buildPhaseCommitMessage(phase: Phase): string @L190-197
- function advanceToNextPhase(state: ProjectState): Phase | null @L417-425
- interface ApplyReportOptions @L495-502
- function applyAutoReport(phase: Phase, state: ProjectState, cwd: string, applyOpts: ApplyReportOptions): Promise<AutoApplyResult> @L504-589
- function applyDone(cwd: string, opts: ApplyReportOptions): Promise<StepOutcome> @L829-871
