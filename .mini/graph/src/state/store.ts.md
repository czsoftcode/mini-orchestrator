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
- function loadHeader(cwd: string): Promise<StateHeader> @L175-182
- function saveHeader(header: StateHeader, cwd: string): Promise<void> @L184-187
- function loadPhase(cwd: string, id: number): Promise<Phase | null> @L190-192
- function savePhase(phase: Phase, cwd: string): Promise<void> @L194-197
- function loadFullState(cwd: string): Promise<ProjectState> @L200-203
- const load @L206
- function save(state: ProjectState, cwd: string): Promise<void> @L284-296
- function loadPrev(cwd: string): Promise<ProjectState> @L299-303
- function restorePrev(cwd: string): Promise<void> @L306-314
- function readProject(cwd: string): Promise<string> @L316-318
- function writeProject(content: string, cwd: string): Promise<void> @L320-324
- function newState(): ProjectState @L326-333
