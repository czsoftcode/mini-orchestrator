## src/commands/done.ts

Imports:
- { commitAll, hasChanges, headSha, isGitRepo, push } from "../git.js"
- { buildGraph, GRAPH_DIR, hasMappableProject } from "../graph/buildGraph.js"
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
- function done(opts: AutoOptions): Promise<StepOutcome>
- function buildPhaseCommitMessage(phase: Phase): string
- function advanceToNextPhase(state: ProjectState): Phase | null
- interface ApplyReportOptions
- function applyAutoReport(phase: Phase, state: ProjectState, cwd: string, applyOpts: ApplyReportOptions): Promise<AutoApplyResult>
- function applyDone(cwd: string, opts: ApplyReportOptions): Promise<StepOutcome>
