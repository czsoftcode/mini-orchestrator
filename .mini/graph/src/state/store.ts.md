## src/state/store.ts

Imports:
- { access, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
- { join } from "node:path"
- type { Phase, PhaseSummary, ProjectState, StateHeader } from "./types.js"

Exports:
- const SCHEMA_VERSION @L13
- class LegacyStateError @L20-28
- function statePath(cwd: string): string @L34-36
- function statePrevPath(cwd: string): string @L38-40
- function phasesDir(cwd: string): string @L42-44
- function phaseFileName(id: number): string @L51-53
- function phasePath(cwd: string, id: number): string @L55-57
- function projectPath(cwd: string): string @L59-61
- function exists(cwd: string): Promise<boolean> @L63-70
- function hasPrev(cwd: string): Promise<boolean> @L72-79
- function loadHeader(cwd: string): Promise<StateHeader> @L154-161
- function saveHeader(header: StateHeader, cwd: string): Promise<void> @L163-166
- function loadPhase(cwd: string, id: number): Promise<Phase | null> @L169-171
- function savePhase(phase: Phase, cwd: string): Promise<void> @L173-176
- function loadFullState(cwd: string): Promise<ProjectState> @L179-182
- const load @L185
- function save(state: ProjectState, cwd: string): Promise<void> @L238-250
- function loadPrev(cwd: string): Promise<ProjectState> @L253-257
- function restorePrev(cwd: string): Promise<void> @L260-268
- function readProject(cwd: string): Promise<string> @L270-272
- function writeProject(content: string, cwd: string): Promise<void> @L274-278
- function newState(): ProjectState @L280-287
