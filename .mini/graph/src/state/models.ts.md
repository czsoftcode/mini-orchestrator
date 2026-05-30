## src/state/models.ts

Imports:
- type { ProjectModels, ProjectState } from "./types.js"

Exports:
- type ModelScope
- const MODEL_SCOPES
- const SCOPE_LABELS
- function resolveModel(scope: Exclude<ModelScope, 'default'>, state: ProjectState): string | undefined
- function getDefaultModel(state: ProjectState): string | undefined
