## src/state/store.ts

Imports:
- { access, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
- { join } from "node:path"
- type { Phase, PhaseSummary, ProjectState, StateHeader } from "./types.js"

Exports:
- const SCHEMA_VERSION
- class LegacyStateError
- function statePath(cwd: string): string
- function statePrevPath(cwd: string): string
- function phasesDir(cwd: string): string
- function phaseFileName(id: number): string
- function phasePath(cwd: string, id: number): string
- function projectPath(cwd: string): string
- function exists(cwd: string): Promise<boolean>
- function hasPrev(cwd: string): Promise<boolean>
- function loadHeader(cwd: string): Promise<StateHeader>
- function saveHeader(header: StateHeader, cwd: string): Promise<void>
- function loadPhase(cwd: string, id: number): Promise<Phase | null>
- function savePhase(phase: Phase, cwd: string): Promise<void>
- function loadFullState(cwd: string): Promise<ProjectState>
- const load
- function save(state: ProjectState, cwd: string): Promise<void>
- function loadPrev(cwd: string): Promise<ProjectState>
- function restorePrev(cwd: string): Promise<void>
- function readProject(cwd: string): Promise<string>
- function writeProject(content: string, cwd: string): Promise<void>
- function newState(): ProjectState
