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
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [],
    ...overrides,
  };
}

function phase(id: number, status: Phase['status']): Phase {
  return { id, title: `Phase ${id}`, status };
}

function summary(overrides: Partial<RunReportSummary> = {}): RunReportSummary {
  return { verdict: 'done', verify: [], unparseable: false, ...overrides };
}

describe('nextActionHint', () => {
  it('proposes the first phase when currentPhaseId is null', () => {
    const state = makeState({ currentPhaseId: null });
    expect(nextActionHint(state)).toBe('Next: mini next (proposes the first phase)');
  });

  it('falls back to a generic mini next when currentPhaseId points to a missing phase', () => {
    const state = makeState({
      currentPhaseId: 99,
      phases: [phase(1, 'doing')],
    });
    expect(nextActionHint(state)).toBe('Next: mini next');
  });

  it('offers plan and do for a proposed phase', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'proposed')],
    });
    expect(nextActionHint(state)).toBe(
      'Next: mini plan (break it down) or mini do (run directly)',
    );
  });

  it('offers do and done for a planned phase', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'planned')],
    });
    expect(nextActionHint(state)).toBe(
      'Next: mini do (continue) | mini done (mark as done)',
    );
  });

  it('offers do and done for a doing phase (same as planned)', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'doing')],
    });
    expect(nextActionHint(state)).toBe(
      'Next: mini do (continue) | mini done (mark as done)',
    );
  });

  it('proposes the next phase for a done phase', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'done')],
    });
    expect(nextActionHint(state)).toBe('Next: mini next (propose the next phase)');
  });

  it('falls back to a generic mini next for a skipped phase', () => {
    const state = makeState({
      currentPhaseId: 1,
      phases: [phase(1, 'skipped')],
    });
    expect(nextActionHint(state)).toBe('Next: mini next');
  });
});

describe('describeModels', () => {
  it('returns an empty string when there are no models', () => {
    expect(describeModels(makeState())).toBe('');
  });

  it('prints the default scope from models.default', () => {
    const state = makeState({ models: { default: 'claude-opus-4-7' } });
    expect(describeModels(state)).toBe('default=claude-opus-4-7');
  });

  it('ignores the deprecated `model` field (migration is handled by store.load, not describeModels)', () => {
    const state = makeState({ model: 'legacy-model' });
    expect(describeModels(state)).toBe('');
  });

  it('prints scope-specific overrides in MODEL_SCOPES order', () => {
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

  it('omits scopes with no value (only filled ones are printed)', () => {
    const state = makeState({
      models: { default: 'd', do: 'do-m' },
    });
    expect(describeModels(state)).toBe('default=d, do=do-m');
  });
});

describe('openVerifyCount', () => {
  it('returns 0 when there are no verify items', () => {
    expect(openVerifyCount([], phase(1, 'doing'))).toBe(0);
  });

  it('counts items that no one has handled yet', () => {
    const p: Phase = { ...phase(1, 'doing'), resolvedVerify: ['A'] };
    expect(openVerifyCount([{ title: 'A' }, { title: 'B' }, { title: 'C' }], p)).toBe(2);
  });

  it('returns 0 when all items are resolved', () => {
    const p: Phase = { ...phase(1, 'doing'), resolvedVerify: ['A', 'B'] };
    expect(openVerifyCount([{ title: 'A' }, { title: 'B' }], p)).toBe(0);
  });
});

describe('runReportSummaryLines', () => {
  it('returns one line about unreadability for a corrupted report', () => {
    const lines = runReportSummaryLines(summary({ unparseable: true, verdict: null }), phase(1, 'doing'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('cannot be read');
  });

  it('shows the verdict and the number of open verify items', () => {
    const lines = runReportSummaryLines(
      summary({ verdict: 'partial', verify: [{ title: 'A' }, { title: 'B' }] }),
      phase(1, 'doing'),
    );
    expect(lines[0]).toContain('verdict');
    expect(lines[0]).toContain('partial');
    expect(lines[0]).toContain('2 items pending verification');
  });

  it('says "all verified" when the report had verify items but all are resolved', () => {
    const p: Phase = { ...phase(1, 'doing'), resolvedVerify: ['A'] };
    const lines = runReportSummaryLines(summary({ verdict: 'done', verify: [{ title: 'A' }] }), p);
    expect(lines[0]).toContain('all verified');
  });

  it('says "no items to verify" when the report had no verify items', () => {
    const lines = runReportSummaryLines(summary({ verdict: 'done', verify: [] }), phase(1, 'doing'));
    expect(lines[0]).toContain('no items to verify');
  });

  it('prints "verdict unknown" for a missing verdict', () => {
    const lines = runReportSummaryLines(summary({ verdict: null }), phase(1, 'doing'));
    expect(lines[0]).toContain('verdict unknown');
  });
});

describe('isOrphanedDoing', () => {
  it('is not orphaned when the phase is not doing', () => {
    expect(isOrphanedDoing(phase(1, 'done'), [phase(1, 'done')])).toBe(false);
  });

  it('is not an orphaned doing phase with no steps and no subphases (freshly started)', () => {
    expect(isOrphanedDoing(phase(1, 'doing'), [phase(1, 'doing')])).toBe(false);
  });

  it('is orphaned when it has steps and all are closed', () => {
    const p: Phase = {
      ...phase(1, 'doing'),
      steps: [
        { title: 'a', status: 'done' },
        { title: 'b', status: 'skipped' },
      ],
    };
    expect(isOrphanedDoing(p, [p])).toBe(true);
  });

  it('is not orphaned when some step still remains', () => {
    const p: Phase = {
      ...phase(1, 'doing'),
      steps: [
        { title: 'a', status: 'done' },
        { title: 'b', status: 'todo' },
      ],
    };
    expect(isOrphanedDoing(p, [p])).toBe(false);
  });

  it('is orphaned when it has subphases and all are closed', () => {
    const parent = phase(2, 'doing');
    const sub = { ...phase(2, 'done'), id: 2.1 };
    expect(isOrphanedDoing(parent, [parent, sub])).toBe(true);
  });

  it('is not orphaned when some subphase is still open', () => {
    const parent = phase(2, 'doing');
    const sub = { ...phase(2, 'doing'), id: 2.1 };
    expect(isOrphanedDoing(parent, [parent, sub])).toBe(false);
  });
});
