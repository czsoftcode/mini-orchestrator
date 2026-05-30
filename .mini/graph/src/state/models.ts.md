## src/state/models.ts

Imports:
- type { ProjectModels, ProjectState } from "./types.js"

Exports:
- type ModelScope @L3
- const MODEL_SCOPES @L5
- const SCOPE_LABELS @L7-15
- function resolveModel(scope: Exclude<ModelScope, 'default'>, state: ProjectState): string | undefined @L17-19
- function getDefaultModel(state: ProjectState): string | undefined @L21-23
