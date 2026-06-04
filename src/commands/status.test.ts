import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildPhaseDetailJson,
  buildStatusJson,
  describeModels,
  formatDuration,
  ideasSummaryLine,
  isOrphanedDoing,
  nextActionHint,
  openVerifyCount,
  phaseDuration,
  renderPhaseDetail,
  runReportSummaryLines,
  status,
} from './status.js';
import type { RunReportSummary } from '../state/runReport.js';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import { decisionPath, DECISIONS_DIR } from '../state/decisionStore.js';
import { save, writeProject } from '../state/store.js';
import { mkdir, writeFile } from 'node:fs/promises';
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

describe('buildStatusJson', () => {
  const PROJECT = "# Demo project\n\n## What I'm building\nA thing.\n";

  it('captures title, what, models, currentPhaseId and ideasOpen', () => {
    const state = makeState({
      currentPhaseId: 1,
      models: { default: 'opus' },
      phases: [phase(1, 'doing')],
    });
    const json = buildStatusJson(PROJECT, state, 3);
    expect(json).toMatchObject({
      title: 'Demo project',
      what: 'A thing.',
      models: { default: 'opus' },
      currentPhaseId: 1,
      ideasOpen: 3,
    });
  });

  it('maps phases with steps, timestamps and durationMs', () => {
    const p: Phase = {
      ...phase(1, 'done'),
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:02:00.000Z',
      steps: [{ title: 'a', status: 'done' }],
    };
    const json = buildStatusJson(PROJECT, makeState({ phases: [p] }), 0);
    expect(json.phases[0]).toMatchObject({
      id: 1,
      status: 'done',
      durationMs: 120_000,
      steps: [{ title: 'a', status: 'done' }],
    });
  });

  it('omits durationMs when timestamps are incomplete', () => {
    const json = buildStatusJson(PROJECT, makeState({ phases: [phase(1, 'proposed')] }), 0);
    expect(json.phases[0]!.durationMs).toBeUndefined();
  });

  it('serializes to valid JSON', () => {
    const json = buildStatusJson(PROJECT, makeState({ phases: [phase(1, 'done')] }), 1);
    expect(() => JSON.parse(JSON.stringify(json))).not.toThrow();
  });
});

describe('formatDuration', () => {
  it('renders seconds, minutes and the two largest units', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(3 * 60_000)).toBe('3m');
    expect(formatDuration(2 * 3_600_000 + 5 * 60_000)).toBe('2h 5m');
    expect(formatDuration(86_400_000 + 2 * 3_600_000)).toBe('1d 2h');
  });

  it('clamps sub-second and negative inputs to 0s', () => {
    expect(formatDuration(500)).toBe('0s');
    expect(formatDuration(-1000)).toBe('0s');
  });
});

describe('phaseDuration', () => {
  it('computes ms between startedAt and completedAt', () => {
    const p: Phase = {
      ...phase(1, 'done'),
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:03:00.000Z',
    };
    expect(phaseDuration(p)).toBe(180_000);
  });

  it('returns null without both timestamps or when end precedes start', () => {
    expect(phaseDuration(phase(1, 'done'))).toBeNull();
    expect(
      phaseDuration({
        ...phase(1, 'done'),
        startedAt: '2026-01-01T00:05:00.000Z',
        completedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toBeNull();
  });
});

describe('ideasSummaryLine', () => {
  it('summarizes open ideas when there are any', () => {
    expect(ideasSummaryLine(3)).toBe('Ideas: 3 open (mini todo)');
  });

  it('returns null for an empty/closed archive', () => {
    expect(ideasSummaryLine(0)).toBeNull();
  });
});

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

describe('renderPhaseDetail', () => {
  it('renders the header, goal, steps with their detail, and the run report', () => {
    const p: Phase = {
      id: 5,
      title: 'Some phase',
      goal: 'do the thing',
      status: 'done',
      steps: [
        { title: 'step one', status: 'done', detail: 'criterion A' },
        { title: 'step two', status: 'todo' },
      ],
    };
    const out = renderPhaseDetail(
      p,
      summary({ verdict: 'partial', body: 'Free notes line.' }),
      false,
    ).join('\n');

    expect(out).toContain('5. Some phase');
    expect(out).toContain('Goal: do the thing');
    expect(out).toContain('step one');
    expect(out).toContain('criterion A');
    expect(out).toContain('step two');
    expect(out).toContain('Run report:');
    expect(out).toContain('verdict partial');
    expect(out).toContain('Free notes line.');
  });

  it('without a run report shows no Run report section', () => {
    const p: Phase = { id: 1, title: 'P', status: 'proposed', steps: [] };
    const out = renderPhaseDetail(p, null, true).join('\n');
    expect(out).toContain('No steps.');
    expect(out).not.toContain('Run report:');
  });

  it('renders a Decision section with the markdown body when an ADR is present', () => {
    const p: Phase = { id: 5, title: 'P', goal: 'g', status: 'done', steps: [] };
    const out = renderPhaseDetail(
      p,
      null,
      false,
      '# Warn, not error\n\nOrphaned-doing is a legitimate state.',
    ).join('\n');
    expect(out).toContain('Decision:');
    expect(out).toContain('# Warn, not error');
    expect(out).toContain('Orphaned-doing is a legitimate state.');
  });

  it('shows no Decision section when there is no ADR', () => {
    const p: Phase = { id: 5, title: 'P', status: 'done', steps: [] };
    expect(renderPhaseDetail(p, null, false, null).join('\n')).not.toContain('Decision:');
  });
});

describe('buildPhaseDetailJson', () => {
  it('includes step detail, duration and the run report (verdict, verify, body)', () => {
    const p: Phase = {
      id: 7,
      title: 'A phase',
      goal: 'reach the goal',
      status: 'done',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:05:00.000Z',
      steps: [
        { title: 'one', status: 'done', detail: 'criterion' },
        { title: 'two', status: 'skipped' },
      ],
    };
    const json = buildPhaseDetailJson(
      p,
      summary({ verdict: 'partial', verify: [{ title: 'check UI' }], body: 'notes' }),
      true,
    );

    expect(json).toMatchObject({
      id: 7,
      title: 'A phase',
      goal: 'reach the goal',
      status: 'done',
      isCurrent: true,
      durationMs: 300000,
    });
    expect(json.steps).toEqual([
      { title: 'one', status: 'done', detail: 'criterion' },
      { title: 'two', status: 'skipped' },
    ]);
    expect(json.runReport).toEqual({
      verdict: 'partial',
      unparseable: false,
      verify: [{ title: 'check UI' }],
      body: 'notes',
    });
  });

  it('runReport is null when there is no report', () => {
    const p: Phase = { id: 1, title: 'P', goal: undefined, status: 'proposed' };
    const json = buildPhaseDetailJson(p, null);
    expect(json.runReport).toBeNull();
    expect(json.goal).toBeNull();
    expect(json.steps).toEqual([]);
    expect(json.isCurrent).toBe(false);
    expect(json.decision).toBeNull();
  });

  it('carries the raw ADR markdown in the decision field', () => {
    const p: Phase = { id: 5, title: 'P', status: 'done' };
    const json = buildPhaseDetailJson(p, null, false, '# Title\n\nWhy.');
    expect(json.decision).toBe('# Title\n\nWhy.');
  });
});

describe('status --phase (integration)', () => {
  let cwd: string;
  let out: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-status-phase-'));
    out = '';
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      out += `${args.join(' ')}\n`;
    });
    process.exitCode = undefined;
    await writeProject('# Demo\n\n## What I am building\nThing.', cwd);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    logSpy.mockRestore();
    process.exitCode = undefined;
    await rm(cwd, { recursive: true, force: true });
  });

  function makeFullState(phases: Phase[], currentPhaseId: number | null): ProjectState {
    return { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId, phases };
  }

  it('unknown phase → warning and exit code 1', async () => {
    await save(makeFullState([{ id: 1, title: 'P', status: 'done' }], null), cwd);
    await status({ phase: 9 });
    expect(process.exitCode).toBe(1);
  });

  it('unknown phase with --json → JSON error object and exit code 1', async () => {
    await save(makeFullState([{ id: 1, title: 'P', status: 'done' }], null), cwd);
    await status({ phase: 9, json: true });
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(out)).toEqual({ error: 'no-such-phase', phase: 9 });
  });

  it('existing phase prints its detail, steps and run report body', async () => {
    await save(
      makeFullState(
        [
          {
            id: 2,
            title: 'Target phase',
            goal: 'do it',
            status: 'done',
            steps: [{ title: 'build the thing', status: 'done', detail: 'with a test' }],
          },
        ],
        2,
      ),
      cwd,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 2),
      '---\nphase: 2\nverdict: done\nsteps:\n  - title: "build the thing"\n    status: done\n---\n\nAll went well.\n',
      'utf-8',
    );

    await status({ phase: 2 });

    expect(process.exitCode).toBeUndefined();
    expect(out).toContain('2. Target phase');
    expect(out).toContain('Goal: do it');
    expect(out).toContain('build the thing');
    expect(out).toContain('with a test');
    expect(out).toContain('Run report:');
    expect(out).toContain('All went well.');
  });

  it('existing phase with --json emits steps detail and run report body', async () => {
    await save(
      makeFullState(
        [
          {
            id: 3,
            title: 'JSON phase',
            status: 'done',
            steps: [{ title: 's1', status: 'done', detail: 'd1' }],
          },
        ],
        null,
      ),
      cwd,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 3),
      '---\nphase: 3\nverdict: done\nsteps:\n  - title: "s1"\n    status: done\n---\n\nbody text\n',
      'utf-8',
    );

    await status({ phase: 3, json: true });

    const json = JSON.parse(out);
    expect(json.id).toBe(3);
    expect(json.steps).toEqual([{ title: 's1', status: 'done', detail: 'd1' }]);
    expect(json.runReport.verdict).toBe('done');
    expect(json.runReport.body).toBe('body text');
  });

  it('surfaces an existing ADR file in both text and --json output', async () => {
    await save(makeFullState([{ id: 4, title: 'Phase with ADR', status: 'done' }], null), cwd);
    await mkdir(join(cwd, DECISIONS_DIR), { recursive: true });
    const adr = '# Warn, not error\n\n## Decision\nUse a warn.\n\n## Why\nLegitimate mid-phase state.';
    await writeFile(decisionPath(cwd, 4), `${adr}\n`, 'utf-8');

    await status({ phase: 4 });
    expect(out).toContain('Decision:');
    expect(out).toContain('# Warn, not error');
    expect(out).toContain('Legitimate mid-phase state.');

    out = '';
    await status({ phase: 4, json: true });
    expect(JSON.parse(out).decision).toBe(adr);
  });
});
