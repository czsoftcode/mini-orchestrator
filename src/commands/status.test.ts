import { describe, expect, it } from 'vitest';
import {
  describeModels,
  isOrphanedDoing,
  nextActionHint,
  openVerifyCount,
  runReportSummaryLines,
} from './status.js';
import type { RunReportSummary } from '../state/runReport.js';
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

function summary(overrides: Partial<RunReportSummary> = {}): RunReportSummary {
  return { verdict: 'done', verify: [], unparseable: false, ...overrides };
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

describe('openVerifyCount', () => {
  it('vrátí 0, když nejsou žádné verify body', () => {
    expect(openVerifyCount([], phase(1, 'doing'))).toBe(0);
  });

  it('spočítá body, které ještě nikdo neodbavil', () => {
    const p: Phase = { ...phase(1, 'doing'), resolvedVerify: ['A'] };
    expect(openVerifyCount([{ title: 'A' }, { title: 'B' }, { title: 'C' }], p)).toBe(2);
  });

  it('vrátí 0, když jsou všechny body vyřešené', () => {
    const p: Phase = { ...phase(1, 'doing'), resolvedVerify: ['A', 'B'] };
    expect(openVerifyCount([{ title: 'A' }, { title: 'B' }], p)).toBe(0);
  });
});

describe('runReportSummaryLines', () => {
  it('u poškozeného reportu vrátí jeden řádek o nečitelnosti', () => {
    const lines = runReportSummaryLines(summary({ unparseable: true, verdict: null }), phase(1, 'doing'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('nejde přečíst');
  });

  it('ukáže verdikt a počet otevřených verify bodů', () => {
    const lines = runReportSummaryLines(
      summary({ verdict: 'partial', verify: [{ title: 'A' }, { title: 'B' }] }),
      phase(1, 'doing'),
    );
    expect(lines[0]).toContain('verdikt');
    expect(lines[0]).toContain('částečně');
    expect(lines[0]).toContain('2 body k ověření čeká');
  });

  it('řekne „vše ověřeno", když report měl verify body, ale všechny jsou vyřešené', () => {
    const p: Phase = { ...phase(1, 'doing'), resolvedVerify: ['A'] };
    const lines = runReportSummaryLines(summary({ verdict: 'done', verify: [{ title: 'A' }] }), p);
    expect(lines[0]).toContain('vše ověřeno');
  });

  it('řekne „bez bodů k ověření", když report žádné verify body neměl', () => {
    const lines = runReportSummaryLines(summary({ verdict: 'done', verify: [] }), phase(1, 'doing'));
    expect(lines[0]).toContain('bez bodů k ověření');
  });

  it('u chybějícího verdiktu vypíše „verdikt neznámý"', () => {
    const lines = runReportSummaryLines(summary({ verdict: null }), phase(1, 'doing'));
    expect(lines[0]).toContain('verdikt neznámý');
  });
});

describe('isOrphanedDoing', () => {
  it('není osiřelá, když fáze není doing', () => {
    expect(isOrphanedDoing(phase(1, 'done'), [phase(1, 'done')])).toBe(false);
  });

  it('není osiřelá doing fáze bez kroků i bez podfází (čerstvě spuštěná)', () => {
    expect(isOrphanedDoing(phase(1, 'doing'), [phase(1, 'doing')])).toBe(false);
  });

  it('je osiřelá, když má kroky a všechny jsou uzavřené', () => {
    const p: Phase = {
      ...phase(1, 'doing'),
      steps: [
        { title: 'a', status: 'done' },
        { title: 'b', status: 'skipped' },
      ],
    };
    expect(isOrphanedDoing(p, [p])).toBe(true);
  });

  it('není osiřelá, když některý krok ještě zbývá', () => {
    const p: Phase = {
      ...phase(1, 'doing'),
      steps: [
        { title: 'a', status: 'done' },
        { title: 'b', status: 'todo' },
      ],
    };
    expect(isOrphanedDoing(p, [p])).toBe(false);
  });

  it('je osiřelá, když má podfáze a všechny jsou uzavřené', () => {
    const parent = phase(2, 'doing');
    const sub = { ...phase(2, 'done'), id: 2.1 };
    expect(isOrphanedDoing(parent, [parent, sub])).toBe(true);
  });

  it('není osiřelá, když je nějaká podfáze ještě otevřená', () => {
    const parent = phase(2, 'doing');
    const sub = { ...phase(2, 'doing'), id: 2.1 };
    expect(isOrphanedDoing(parent, [parent, sub])).toBe(false);
  });
});
