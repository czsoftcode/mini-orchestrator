import type { ProjectModels, ProjectState } from './types.js';

export type ModelScope = keyof ProjectModels;

export const MODEL_SCOPES: ModelScope[] = ['default', 'next', 'plan', 'do', 'importGsd', 'audit', 'memory'];

export const SCOPE_LABELS: Record<ModelScope, string> = {
  default: 'Default (for everything without its own override)',
  next: 'next (phase suggestion)',
  plan: 'plan (breakdown into steps)',
  do: 'do (the actual work)',
  importGsd: 'import-gsd (importing a GSD project)',
  audit: 'audit (codebase overview for Claude)',
  memory: 'memory (writing memory after a phase)',
};

export function resolveModel(scope: Exclude<ModelScope, 'default'>, state: ProjectState): string | undefined {
  return state.models?.[scope] ?? state.models?.default;
}

export function getDefaultModel(state: ProjectState): string | undefined {
  return state.models?.default;
}
