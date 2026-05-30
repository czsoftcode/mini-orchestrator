import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, save, writeProject } from '../state/store.js';
import type { ProjectState } from '../state/types.js';

// Interaktivní `do` se před spuštěním Claude ptá na potvrzení — v testu
// odpovídáme „ano", ať se dostaneme až ke spuštění Claude session.
vi.mock('../ui/ask.js', () => ({
  ask: vi.fn(async () => ({ confirm: true })),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

const workWithClaudeMock = vi.fn((..._args: unknown[]) => Promise.resolve({ exitCode: 0 }));
vi.mock('../claude/work.js', () => ({
  workWithClaude: (...args: unknown[]) => workWithClaudeMock(...args),
}));

const streamWithClaudeMock = vi.fn((..._args: unknown[]) => Promise.resolve({ exitCode: 0 }));
vi.mock('../claude/stream.js', () => ({
  streamWithClaude: (...args: unknown[]) => streamWithClaudeMock(...args),
}));

const { doPhase, applyStepDone } = await import('./do.js');

function stateWithOpenStep(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: 1,
    phases: [
      {
        id: 1,
        title: 'Fáze',
        goal: 'něco udělat',
        status: 'planned',
        steps: [{ title: 'krok 1', status: 'todo' }],
      },
    ],
  };
}

describe('doPhase — propagace --max-turns (R1)', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-do-'));
    process.chdir(cwd);
    workWithClaudeMock.mockClear();
    streamWithClaudeMock.mockClear();
    await writeProject('# Projekt', cwd);
    await save(stateWithOpenStep(), cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('předá maxTurns do workWithClaude (neinteraktivní běh)', async () => {
    const r = await doPhase({ maxTurns: 5 });

    expect(r.ok).toBe(true);
    expect(streamWithClaudeMock).not.toHaveBeenCalled();
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const opts = workWithClaudeMock.mock.calls[0]![1] as { maxTurns?: number };
    expect(opts.maxTurns).toBe(5);
  });

  it('předá maxTurns do streamWithClaude (--stream)', async () => {
    const r = await doPhase({ stream: true, maxTurns: 3 });

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).not.toHaveBeenCalled();
    expect(streamWithClaudeMock).toHaveBeenCalledTimes(1);
    const opts = streamWithClaudeMock.mock.calls[0]![1] as { maxTurns?: number };
    expect(opts.maxTurns).toBe(3);
  });

  it('bez --max-turns je maxTurns undefined', async () => {
    await doPhase({});

    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const opts = workWithClaudeMock.mock.calls[0]![1] as unknown as { maxTurns?: number };
    expect(opts.maxTurns).toBeUndefined();
  });
});

describe('applyStepDone — průběžný zápis kroku', () => {
  let cwd: string;
  let prevCwd: string;

  function doingStateWithSteps(): ProjectState {
    return {
      version: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      currentPhaseId: 1,
      phases: [
        {
          id: 1,
          title: 'Fáze',
          goal: 'něco udělat',
          status: 'doing',
          steps: [
            { title: 'První krok', status: 'todo' },
            { title: 'Druhý krok', status: 'todo' },
          ],
        },
      ],
    };
  }

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-stepdone-'));
    process.chdir(cwd);
    await writeProject('# Projekt', cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('označí krok podle přesného názvu jako hotový a uloží stav', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('První krok', cwd);

    expect(r.ok).toBe(true);
    const state = await load(cwd);
    const steps = state.phases[0]!.steps!;
    expect(steps[0]!.status).toBe('done');
    expect(steps[1]!.status).toBe('todo');
  });

  it('páruje tolerantně — okrajové mezery a velikost písmen', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('  druhý KROK  ', cwd);

    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.steps![1]!.status).toBe('done');
  });

  it('nenalezený krok vrátí chybu a stav nezmění', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('neexistující krok', cwd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('step-not-found');
    const state = await load(cwd);
    expect(state.phases[0]!.steps!.every((s) => s.status === 'todo')).toBe(true);
  });

  it('líně nastartuje fázi, když ještě není doing (planned), a označí krok', async () => {
    const state = doingStateWithSteps();
    state.phases[0]!.status = 'planned';
    await save(state, cwd);

    const r = await applyStepDone('První krok', cwd);

    expect(r.ok).toBe(true);
    const after = await load(cwd);
    expect(after.phases[0]!.status).toBe('doing');
    expect(after.phases[0]!.startedAt).toBeTruthy();
    expect(after.phases[0]!.steps![0]!.status).toBe('done');
    // .mini/run/ musí vzniknout, aby měl Claude kam zapsat report
    await expect(access(join(cwd, '.mini', 'run'))).resolves.toBeUndefined();
  });

  it('odmítne zápis na uzavřené fázi (done/skipped)', async () => {
    const state = doingStateWithSteps();
    state.phases[0]!.status = 'done';
    await save(state, cwd);

    const r = await applyStepDone('První krok', cwd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('phase-closed');

    state.phases[0]!.status = 'skipped';
    await save(state, cwd);

    const r2 = await applyStepDone('První krok', cwd);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('phase-closed');
  });

  it('prázdný název kroku vrátí chybu', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('   ', cwd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-step-title');
  });
});
