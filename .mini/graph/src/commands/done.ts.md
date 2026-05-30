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
- function done(opts: AutoOptions): Promise<StepOutcome> @L19-139
- function buildPhaseCommitMessage(phase: Phase): string @L187-194
- function advanceToNextPhase(state: ProjectState): Phase | null @L328-336
- interface ApplyReportOptions @L406-413
- function applyAutoReport(phase: Phase, state: ProjectState, cwd: string, applyOpts: ApplyReportOptions): Promise<AutoApplyResult> @L415-500
- function applyDone(cwd: string, opts: ApplyReportOptions): Promise<StepOutcome> @L740-782
