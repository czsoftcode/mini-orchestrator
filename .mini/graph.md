# Graf projektu

Strojově generovaný přehled zdrojových souborů (TS/TSX, PHP, Rust) — exporty, importy, signatury. Neupravuj ručně — `mini map` ho přegeneruje.

## src/claude/ask.ts

Imports:
- { spawn } from "node:child_process"
- type { PermissionMode } from "./work.js"

Exports:
- interface AskOptions
- interface AskUsage
- interface AskResult
- function askClaude(prompt: string, opts: AskOptions): Promise<AskResult>

## src/claude/stream.test.ts

Imports:
- { EventEmitter } from "node:events"
- { beforeEach, describe, expect, it, vi } from "vitest"
- { createLineBuffer, parseStreamEvent, streamWithClaude, AssistantEvent, ResultEvent, SystemInitEvent, UnknownEvent, UserEvent } from "./stream.js"

## src/claude/stream.ts

Imports:
- { spawn } from "node:child_process"
- type { PermissionMode } from "./work.js"

Exports:
- interface StreamOptions
- interface StreamUsage
- interface StreamResult
- type StreamEvent
- interface SystemInitEvent
- interface AssistantEvent
- interface UserEvent
- interface ResultEvent
- interface UnknownEvent
- interface ToolUse
- interface ToolResult
- type RawEnvelope
- function parseStreamEvent(line: string): StreamEvent | null
- function createLineBuffer(onLine: (line: string) => void): { push: (chunk: string) => void; flush: () => void; }
- function streamWithClaude(prompt: string, opts: StreamOptions): Promise<StreamResult>

## src/claude/work.ts

Imports:
- { spawn } from "node:child_process"

Exports:
- type PermissionMode
- interface WorkOptions
- interface WorkResult
- function workWithClaude(prompt: string, opts: WorkOptions): Promise<WorkResult>

## src/cli.ts

Imports:
- { Command, InvalidArgumentError } from "commander"

## src/commands/audit.ts

Imports:
- { askClaude } from "../claude/ask.js"
- { buildAuditCodebasePrompt, CODEBASE_FILE } from "../prompts/auditCodebase.js"
- { isBrownfield } from "../state/brownfield.js"
- { resolveModel } from "../state/models.js"
- { exists, readProject, load } from "../state/store.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"
- type { StepOutcome } from "./types.js"

Exports:
- function audit(): Promise<StepOutcome>

## src/commands/auto.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { readFileSync } from "node:fs"
- { mkdtemp, rm, stat, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { ensureRunDir, runReportPath } from "../state/runReport.js"
- { load, save, writeProject } from "../state/store.js"
- type { Phase, ProjectState } from "../state/types.js"

## src/commands/auto.ts

Imports:
- { rename } from "node:fs/promises"
- { join } from "node:path"
- type { AutoPhaseRetryContext } from "../prompts/autoPhase.js"
- { RUN_DIR, previousRunReportPath, runReportPath } from "../state/runReport.js"
- { exists, load } from "../state/store.js"
- { log } from "../ui/log.js"
- { doPhase } from "./do.js"
- { done } from "./done.js"
- { next } from "./next.js"
- { plan } from "./plan.js"
- type { AutoOptions } from "./types.js"

Exports:
- function auto(opts: AutoOptions): Promise<void>

## src/commands/discuss.ts

Imports:
- { access, mkdir } from "node:fs/promises"
- { join } from "node:path"
- { workWithClaude } from "../claude/work.js"
- { buildDiscussPhasePrompt } from "../prompts/discussPhase.js"
- { exists, load, readProject, save } from "../state/store.js"
- type { Phase } from "../state/types.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"
- type { StepOutcome } from "./types.js"

Exports:
- function discuss(): Promise<StepOutcome>

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

## src/commands/done.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { advanceToNextPhase, buildPhaseCommitMessage, done } from "./done.js"
- { ensureRunDir, runReportPath } from "../state/runReport.js"
- { load, save } from "../state/store.js"
- type { Phase, ProjectState } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { commitAll, hasChanges, headSha, isGitRepo } from "../git.js"
- { writePhaseMemory } from "./writeMemory.js"

## src/commands/done.ts

Imports:
- { commitAll, hasChanges, headSha, isGitRepo } from "../git.js"
- { buildGraph, GRAPH_FILE, hasMappableProject } from "../graph/buildGraph.js"
- { RunReportParseError, readRunReport, runReportPath, RunReport } from "../state/runReport.js"
- { exists, load, save } from "../state/store.js"
- type { Phase, ProjectState, Step } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { log } from "../ui/log.js"
- type { AutoOptions, StepOutcome } from "./types.js"
- { writePhaseMemory } from "./writeMemory.js"

Exports:
- function done(opts: AutoOptions): Promise<StepOutcome>
- function buildPhaseCommitMessage(phase: Phase): string
- function advanceToNextPhase(state: ProjectState): Phase | null

## src/commands/import-gsd.ts

Imports:
- { access } from "node:fs/promises"
- { join } from "node:path"
- { askClaude } from "../claude/ask.js"
- { buildImportGsdPrompt } from "../prompts/importGsd.js"
- { resolveModel } from "../state/models.js"
- { exists, load, newState, save, writeProject } from "../state/store.js"
- type { Phase, PhaseStatus, ProjectModels } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"

Exports:
- function importGsd(): Promise<void>

## src/commands/init.ts

Imports:
- { basename } from "node:path"
- { isBrownfield } from "../state/brownfield.js"
- { exists, newState, save, writeProject } from "../state/store.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"

Exports:
- function init(): Promise<void>

## src/commands/map.test.ts

Imports:
- { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { map } from "./map.js"

## src/commands/map.ts

Imports:
- { buildGraph, GRAPH_FILE, hasMappableProject } from "../graph/buildGraph.js"
- { exists } from "../state/store.js"
- { log } from "../ui/log.js"
- type { StepOutcome } from "./types.js"

Exports:
- function map(): Promise<StepOutcome>

## src/commands/model.ts

Imports:
- { MODEL_SCOPES, SCOPE_LABELS, ModelScope } from "../state/models.js"
- { exists, load, save } from "../state/store.js"
- type { ProjectState } from "../state/types.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"

Exports:
- function model(arg1?: string, arg2?: string): Promise<void>

## src/commands/next.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { parseSuggestion } from "./next.js"

## src/commands/next.ts

Imports:
- { readFile } from "node:fs/promises"
- { join } from "node:path"
- { askClaude } from "../claude/ask.js"
- { buildNextPhasePrompt } from "../prompts/nextPhase.js"
- { LAST_MEMORY_FILE } from "../prompts/writeMemory.js"
- { resolveModel } from "../state/models.js"
- { exists, load, readProject, save } from "../state/store.js"
- type { Phase, ProjectState } from "../state/types.js"
- { ask, nonEmpty, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"
- type { AutoOptions, StepOutcome } from "./types.js"

Exports:
- interface ParsedSuggestion
- function next(opts: AutoOptions): Promise<StepOutcome>
- function parseSuggestion(text: string): ParsedSuggestion | null

## src/commands/plan.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { parseSteps } from "./plan.js"

## src/commands/plan.ts

Imports:
- { askClaude } from "../claude/ask.js"
- { buildPlanPhasePrompt } from "../prompts/planPhase.js"
- { readDiscussNotes } from "../state/discussNotes.js"
- { resolveModel } from "../state/models.js"
- { exists, load, readProject, save } from "../state/store.js"
- type { Step } from "../state/types.js"
- { ask, trim } from "../ui/ask.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"
- type { AutoOptions, StepOutcome } from "./types.js"

Exports:
- function plan(opts: AutoOptions): Promise<StepOutcome>
- function parseSteps(text: string): string[]

## src/commands/status.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { describeModels, nextActionHint } from "./status.js"
- type { Phase, ProjectState } from "../state/types.js"

## src/commands/status.ts

Imports:
- { default } from "picocolors"
- { MODEL_SCOPES } from "../state/models.js"
- { exists, load, readProject } from "../state/store.js"
- type { Phase, PhaseStatus, ProjectState, StepStatus } from "../state/types.js"
- { log } from "../ui/log.js"

Exports:
- function status(): Promise<void>
- function describeModels(state: ProjectState): string
- function nextActionHint(state: ProjectState): string

## src/commands/types.ts

Exports:
- type StepOutcome
- interface AutoOptions

## src/commands/undo.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
- { mkdtemp, rm } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { save } from "../state/store.js"
- type { PhaseAutoCommit, ProjectState } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { headSha, isCleanWorkingTree, isGitRepo, softResetTo } from "../git.js"

## src/commands/undo.ts

Imports:
- { headSha, isCleanWorkingTree, isGitRepo, softResetTo } from "../git.js"
- { exists, hasPrev, load, loadPrev, restorePrev } from "../state/store.js"
- type { PhaseAutoCommit, ProjectState } from "../state/types.js"
- { ask } from "../ui/ask.js"
- { log } from "../ui/log.js"

Exports:
- function undo(): Promise<void>

## src/commands/writeMemory.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildPhaseMemoryMarkdown } from "./writeMemory.js"
- type { Phase } from "../state/types.js"

## src/commands/writeMemory.ts

Imports:
- { access, copyFile, mkdir, readFile, symlink, unlink, writeFile } from "node:fs/promises"
- { join, relative } from "node:path"
- { askClaude } from "../claude/ask.js"
- { buildWriteMemoryPrompt, LAST_MEMORY_FILE, MEMORY_DIR } from "../prompts/writeMemory.js"
- { readProject } from "../state/store.js"
- type { Phase, ProjectState, StepStatus } from "../state/types.js"
- { log } from "../ui/log.js"
- { logUsage } from "../ui/usage.js"

Exports:
- function writePhaseMemory(phase: Phase, state: ProjectState, cwd: string, options: { hasAutoCommit: boolean; }): Promise<void>
- function buildPhaseMemoryMarkdown(phase: Phase, discussContent: string, runContent: string): string
- function fsSafeTimestamp(date: Date): string

## src/git.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { execFile } from "node:child_process"
- { mkdtemp, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { promisify } from "node:util"
- { commitAll, currentBranch, hasChanges, headSha, headSubject, isCleanWorkingTree, isGitRepo, runGit, softResetTo } from "./git.js"

## src/git.ts

Imports:
- { execFile } from "node:child_process"
- { promisify } from "node:util"

Exports:
- interface GitResult
- function runGit(args: string[], cwd: string): Promise<GitResult>
- function isGitRepo(cwd: string): Promise<boolean>
- function hasChanges(cwd: string): Promise<boolean>
- function commitAll(cwd: string, message: string): Promise<GitResult>
- function currentBranch(cwd: string): Promise<string | null>
- function headSha(cwd: string): Promise<string | null>
- function headSubject(cwd: string): Promise<string | null>
- function isCleanWorkingTree(cwd: string): Promise<boolean>
- function softResetTo(cwd: string, sha: string): Promise<GitResult>

## src/graph/buildGraph.test.ts

Imports:
- { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { buildGraph, GRAPH_FILE, hasMappableProject, renderGraphMarkdown } from "./buildGraph.js"

## src/graph/buildGraph.ts

Imports:
- { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises"
- { join, posix, relative, sep } from "node:path"
- { mapFile } from "./mapper.js"
- { mapPhpFile } from "./phpMapper.js"
- { mapRustFile } from "./rustMapper.js"
- type { ExportInfo, FileGraph, ImportInfo } from "./types.js"

Exports:
- const GRAPH_FILE
- interface BuildGraphResult
- interface BuildGraphOptions
- function buildGraph(cwd: string, options: BuildGraphOptions): Promise<BuildGraphResult>
- function hasMappableProject(cwd: string): Promise<boolean>
- function renderGraphMarkdown(files: FileGraph[]): string

## src/graph/mapper.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { mapFile } from "./mapper.js"

## src/graph/mapper.ts

Imports:
- { default } from "typescript"
- type { ExportInfo, ExportKind, FileGraph, FunctionSignature, ImportInfo, MethodSignature, Parameter } from "./types.js"

Exports:
- function mapFile(content: string, relPath: string): FileGraph

## src/graph/phpMapper.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { mapPhpFile } from "./phpMapper.js"

## src/graph/phpMapper.ts

Imports:
- type { ExportInfo, FileGraph, FunctionSignature, ImportInfo, MethodSignature, Parameter } from "./types.js"

Exports:
- function mapPhpFile(content: string, relPath: string): FileGraph

## src/graph/rustMapper.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { mapRustFile } from "./rustMapper.js"

## src/graph/rustMapper.ts

Imports:
- type { ExportInfo, FileGraph, FunctionSignature, ImportInfo, Parameter } from "./types.js"

Exports:
- function mapRustFile(content: string, relPath: string): FileGraph

## src/graph/types.ts

Exports:
- type ExportKind
- interface Parameter
- interface FunctionSignature
- interface MethodSignature
- interface ExportInfo
- interface ImportInfo
- interface FileGraph

## src/prompts/auditCodebase.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildAuditCodebasePrompt, CODEBASE_FILE } from "./auditCodebase.js"

## src/prompts/auditCodebase.ts

Exports:
- const CODEBASE_FILE
- function buildAuditCodebasePrompt(projectMd: string): string

## src/prompts/autoPhase.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildAutoPhasePrompt } from "./autoPhase.js"
- type { Phase } from "../state/types.js"

## src/prompts/autoPhase.ts

Imports:
- type { Phase, StepStatus } from "../state/types.js"

Exports:
- interface AutoPhaseRetryContext
- interface AutoPhaseContext
- function buildAutoPhasePrompt(ctx: AutoPhaseContext): string

## src/prompts/discussPhase.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildDiscussPhasePrompt } from "./discussPhase.js"
- type { Phase } from "../state/types.js"

## src/prompts/discussPhase.ts

Imports:
- type { Phase, Step, StepStatus } from "../state/types.js"

Exports:
- function buildDiscussPhasePrompt(projectMd: string, phase: Phase): string

## src/prompts/doPhase.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildDoPhasePrompt } from "./doPhase.js"
- type { Phase } from "../state/types.js"

## src/prompts/doPhase.ts

Imports:
- type { Phase, Step, StepStatus } from "../state/types.js"

Exports:
- interface DoPhaseContext
- function buildDoPhasePrompt(ctx: DoPhaseContext): string

## src/prompts/importGsd.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildImportGsdPrompt } from "./importGsd.js"

## src/prompts/importGsd.ts

Exports:
- function buildImportGsdPrompt(): string

## src/prompts/nextPhase.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildNextPhasePrompt } from "./nextPhase.js"
- type { ProjectState } from "../state/types.js"

## src/prompts/nextPhase.ts

Imports:
- type { PhaseStatus, ProjectState } from "../state/types.js"

Exports:
- interface BuildNextPhaseOptions
- function buildNextPhasePrompt(projectMd: string, state: ProjectState, optionsOrHint?: BuildNextPhaseOptions | string): string

## src/prompts/planPhase.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildPlanPhasePrompt } from "./planPhase.js"
- type { Phase } from "../state/types.js"

## src/prompts/planPhase.ts

Imports:
- type { Phase } from "../state/types.js"

Exports:
- function buildPlanPhasePrompt(projectMd: string, phase: Phase, discussNotes?: string | null): string

## src/prompts/writeMemory.test.ts

Imports:
- { describe, expect, it } from "vitest"
- { buildWriteMemoryPrompt, LAST_MEMORY_FILE, MEMORY_DIR } from "./writeMemory.js"
- type { Phase } from "../state/types.js"

## src/prompts/writeMemory.ts

Imports:
- type { Phase, Step, StepStatus } from "../state/types.js"

Exports:
- const MEMORY_DIR
- const LAST_MEMORY_FILE
- interface WriteMemoryPromptInput
- function buildWriteMemoryPrompt(input: WriteMemoryPromptInput): string

## src/state/brownfield.ts

Imports:
- { readdir } from "node:fs/promises"

Exports:
- const BROWNFIELD_IGNORED
- function isBrownfield(cwd: string): Promise<boolean>

## src/state/discussNotes.ts

Imports:
- { readFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- const DISCUSS_DIR
- function discussNotesPath(cwd: string, phaseId: number): string
- function readDiscussNotes(cwd: string, phaseId: number): Promise<string | null>

## src/state/models.ts

Imports:
- type { ProjectModels, ProjectState } from "./types.js"

Exports:
- type ModelScope
- const MODEL_SCOPES
- const SCOPE_LABELS
- function resolveModel(scope: Exclude<ModelScope, 'default'>, state: ProjectState): string | undefined
- function getDefaultModel(state: ProjectState): string | undefined

## src/state/runReport.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { RUN_DIR, RunReportParseError, parseRunReport, readRunReport, runReportPath } from "./runReport.js"

## src/state/runReport.ts

Imports:
- { access, mkdir, readFile } from "node:fs/promises"
- { join } from "node:path"

Exports:
- const RUN_DIR
- type RunStepStatus
- type RunVerdict
- interface RunReportStep
- interface RunReport
- function runReportPath(cwd: string, phaseId: number): string
- function previousRunReportPath(cwd: string, phaseId: number): string
- function ensureRunDir(cwd: string): Promise<void>
- function runReportExists(cwd: string, phaseId: number): Promise<boolean>
- class RunReportParseError
- interface ParseRunReportContext
- function parseRunReport(text: string, ctx: ParseRunReportContext): RunReport
- function readRunReport(cwd: string, ctx: ParseRunReportContext): Promise<RunReport | null>

## src/state/store.test.ts

Imports:
- { afterEach, beforeEach, describe, expect, it } from "vitest"
- { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
- { tmpdir } from "node:os"
- { join } from "node:path"
- { exists, hasPrev, load, loadPrev, newState, restorePrev, save, statePath, statePrevPath } from "./store.js"
- type { ProjectState } from "./types.js"

## src/state/store.ts

Imports:
- { access, mkdir, readFile, rename, writeFile } from "node:fs/promises"
- { join } from "node:path"
- type { ProjectState } from "./types.js"

Exports:
- function statePath(cwd: string): string
- function statePrevPath(cwd: string): string
- function projectPath(cwd: string): string
- function exists(cwd: string): Promise<boolean>
- function hasPrev(cwd: string): Promise<boolean>
- function load(cwd: string): Promise<ProjectState>
- function loadPrev(cwd: string): Promise<ProjectState>
- function save(state: ProjectState, cwd: string): Promise<void>
- function restorePrev(cwd: string): Promise<void>
- function readProject(cwd: string): Promise<string>
- function writeProject(content: string, cwd: string): Promise<void>
- function newState(): ProjectState

## src/state/types.ts

Exports:
- type StepStatus
- type PhaseStatus
- interface Step
- interface PhaseAutoCommit
- interface Phase
- interface ProjectModels
- interface ProjectState

## src/ui/ask.ts

Imports:
- { default, Answers, PromptObject } from "prompts"
- { log } from "./log.js"

Exports:
- function ask(questions: PromptObject<T> | Array<PromptObject<T>>): Promise<Answers<T>>
- function nonEmpty(label)
- function trim(value: string): string

## src/ui/log.ts

Imports:
- { default } from "picocolors"

Exports:
- const log

## src/ui/streamRender.ts

Imports:
- { default } from "picocolors"
- type { StreamEvent, ToolUse } from "../claude/stream.js"
- { log } from "./log.js"

Exports:
- interface StreamRenderer
- function createStreamRenderer(): StreamRenderer

## src/ui/usage.ts

Imports:
- type { AskResult } from "../claude/ask.js"
- type { StreamResult } from "../claude/stream.js"
- { log } from "./log.js"

Exports:
- function logUsage(response: AskResult): void
- function logStreamSummary(result: StreamResult): void

## vitest.config.ts

Imports:
- { defineConfig } from "vitest/config"

Exports:
- const default (default)
