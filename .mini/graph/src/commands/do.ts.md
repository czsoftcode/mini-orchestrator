## src/commands/do.ts

Imports:
- { streamWithClaude } from "../claude/stream.js"
- { workWithClaude } from "../claude/work.js"
- { buildAutoPhasePrompt, AutoPhaseRetryContext } from "../prompts/autoPhase.js"
- { buildDoPhasePrompt } from "../prompts/doPhase.js"
- { readDiscussNotes } from "../state/discussNotes.js"
- { resolveModel } from "../state/models.js"
- { ensureRunDir } from "../state/runReport.js"
- { exists, load, readProject, save } from "../state/store.js"
- type { Step } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { log } from "../ui/log.js"
- { createStreamRenderer } from "../ui/streamRender.js"
- { logStreamSummary } from "../ui/usage.js"
- type { AutoOptions, StepOutcome } from "./types.js"

Exports:
- interface DoPhaseOptions
- function doPhase(opts: DoPhaseOptions): Promise<StepOutcome>
- function applyDoStart(cwd: string): Promise<StepOutcome>
- function applyStepDone(title: string, cwd: string): Promise<StepOutcome>
