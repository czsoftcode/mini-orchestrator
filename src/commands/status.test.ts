import { describe, expect, it } from 'vitest';
import { describeModels, nextActionHint } from './status.js';
import type { Phase, ProjectState } from '../state/types.js';

function makeState(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [],
    ...overrides,
  };
}

function phase(id: number, status: Phase['status']): Phase {
  return { id, title: `Fáze ${id}`, status };
}

describe('nextActionHint', () => {
  it('navrhne první fázi, když currentPhaseId je null', () => {
    const state = makeState({ currentPhaseId: null });
    expect(nextActionHint(state)).toBe('Další: mini next (navrhne první fázi)');
  });

  it('padá na obecný mini next, když currentPhaseId odkazuje na neexistující fázi', () => {
    const state = makeState({
      currentPhaseId: 99,
      phases: [phase(1, 'doing')],
    });
    expect(nextActionHint(state)).toBe('Další: mini next');
  });

  it('u proposed fáze nabídne plan i do', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'proposed')],
    });
    expect(nextActionHint(state)).toBe(
      'Další: mini plan (rozmenit) nebo mini do (spustit přímo)',
    );
  });

  it('u planned fáze nabídne do i done', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'planned')],
    });
    expect(nextActionHint(state)).toBe(
      'Další: mini do (pokračovat) | mini done (označit hotové)',
    );
  });

  it('u doing fáze nabídne do i done (stejně jako planned)', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'doing')],
    });
    expect(nextActionHint(state)).toBe(
      'Další: mini do (pokračovat) | mini done (označit hotové)',
    );
  });

  it('u done fáze navrhne další fázi', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'done')],
    });
    expect(nextActionHint(state)).toBe('Další: mini next (navrhnout další fázi)');
  });

  it('u skipped fáze padá na obecný mini next', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'skipped')],
    });
    expect(nextActionHint(state)).toBe('Další: mini next');
  });
});

describe('describeModels', () => {
  it('vrátí prázdný řetězec, když nejsou žádné modely', () => {
    expect(describeModels(makeState())).toBe('');
  });

  it('vypíše default scope z models.default', () => {
    const state = makeState({ models: { default: 'claude-opus-4-7' } });
    expect(describeModels(state)).toBe('default=claude-opus-4-7');
  });

  it('ignoruje zastaralé pole `model` (migraci řeší store.load, ne describeModels)', () => {
    const state = makeState({ model: 'legacy-model' });
    expect(describeModels(state)).toBe('');
  });

  it('vypíše scope-specifické override v pořadí MODEL_SCOPES', () => {
    const state = makeState({
      models: {
        default: 'd',
        next: 'n',
        plan: 'p',
        do: 'do-m',
        importGsd: 'ig',
        audit: 'a',
        memory: 'm',
      },
    });
    expect(describeModels(state)).toBe(
      'default=d, next=n, plan=p, do=do-m, importGsd=ig, audit=a, memory=m',
    );
  });

  it('vynechá scopy bez hodnoty (jen vyplněné se vypíšou)', () => {
    const state = makeState({
      models: { default: 'd', do: 'do-m' },
    });
    expect(describeModels(state)).toBe('default=d, do=do-m');
  });
});
