export const MODEL_SCOPES = ['default', 'next', 'plan', 'do', 'importGsd', 'audit', 'memory'];
export const SCOPE_LABELS = {
    default: 'Default (pro vše, co nemá vlastní override)',
    next: 'next (návrh fáze)',
    plan: 'plan (rozmen na kroky)',
    do: 'do (skutečná práce)',
    importGsd: 'import-gsd (import GSD projektu)',
    audit: 'audit (přehled kódu pro Clauda)',
    memory: 'memory (zápis paměti po fázi)',
};
export function resolveModel(scope, state) {
    return state.models?.[scope] ?? state.models?.default;
}
export function getDefaultModel(state) {
    return state.models?.default;
}
