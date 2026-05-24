import type { ProjectModels, ProjectState } from './types.js';

export type ModelScope = keyof ProjectModels;

export const MODEL_SCOPES: ModelScope[] = ['default', 'next', 'plan', 'do', 'importGsd', 'audit', 'memory'];

export const SCOPE_LABELS: Record<ModelScope, string> = {
  default: 'Default (pro vše, co nemá vlastní override)',
  next: 'next (návrh fáze)',
  plan: 'plan (rozmen na kroky)',
  do: 'do (skutečná práce)',
  importGsd: 'import-gsd (import GSD projektu)',
  audit: 'audit (přehled kódu pro Clauda)',
  memory: 'memory (zápis paměti po fázi)',
};

export function resolveModel(scope: Exclude<ModelScope, 'default'>, state: ProjectState): string | undefined {
  return state.models?.[scope] ?? state.models?.default ?? state.model;
}

export function getDefaultModel(state: ProjectState): string | undefined {
  return state.models?.default ?? state.model;
}
