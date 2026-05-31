import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, save, writeProject } from '../state/store.js';
import type { ProjectState } from '../state/types.js';

// Interactive `do` asks for confirmation before starting Claude — in the test
// we answer "yes" so we get all the way to starting the Claude session.
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
        title: 'Phase',
        goal: 'do something',
        status: 'planned',
        steps: [{ title: 'step 1', status: 'todo' }],
      },
    ],
  };
}

describe('doPhase — propagating --max-turns (R1)', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-do-'));
    process.chdir(cwd);
    workWithClaudeMock.mockClear();
    streamWithClaudeMock.mockClear();
    await writeProject('# Project', cwd);
    await save(stateWithOpenStep(), cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('passes maxTurns to workWithClaude (non-interactive run)', async () => {
    const r = await doPhase({ maxTurns: 5 });

    expect(r.ok).toBe(true);
    expect(streamWithClaudeMock).not.toHaveBeenCalled();
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const opts = workWithClaudeMock.mock.calls[0]![1] as { maxTurns?: number };
    expect(opts.maxTurns).toBe(5);
  });

  it('passes maxTurns to streamWithClaude (--stream)', async () => {
    const r = await doPhase({ stream: true, maxTurns: 3 });

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).not.toHaveBeenCalled();
    expect(streamWithClaudeMock).toHaveBeenCalledTimes(1);
    const opts = streamWithClaudeMock.mock.calls[0]![1] as { maxTurns?: number };
    expect(opts.maxTurns).toBe(3);
  });

  it('without --max-turns maxTurns is undefined', async () => {
    await doPhase({});

    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const opts = workWithClaudeMock.mock.calls[0]![1] as unknown as { maxTurns?: number };
    expect(opts.maxTurns).toBeUndefined();
  });
});

describe('applyStepDone — incremental step write', () => {
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
          title: 'Phase',
          goal: 'do something',
          status: 'doing',
          steps: [
            { title: 'First step', status: 'todo' },
            { title: 'Second step', status: 'todo' },
          ],
        },
      ],
    };
  }

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-stepdone-'));
    process.chdir(cwd);
    await writeProject('# Project', cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('marks the step done by exact name and saves the state', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('First step', cwd);

    expect(r.ok).toBe(true);
    const state = await load(cwd);
    const steps = state.phases[0]!.steps!;
    expect(steps[0]!.status).toBe('done');
    expect(steps[1]!.status).toBe('todo');
  });

  it('matches tolerantly — edge spaces and letter case', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('  second STEP  ', cwd);

    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.steps![1]!.status).toBe('done');
  });

  it('a step not found returns an error and does not change the state', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('nonexistent step', cwd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('step-not-found');
    const state = await load(cwd);
    expect(state.phases[0]!.steps!.every((s) => s.status === 'todo')).toBe(true);
  });

  it('lazily starts the phase when it is not yet doing (planned), and marks the step', async () => {
    const state = doingStateWithSteps();
    state.phases[0]!.status = 'planned';
    await save(state, cwd);

    const r = await applyStepDone('First step', cwd);

    expect(r.ok).toBe(true);
    const after = await load(cwd);
    expect(after.phases[0]!.status).toBe('doing');
    expect(after.phases[0]!.startedAt).toBeTruthy();
    expect(after.phases[0]!.steps![0]!.status).toBe('done');
    // .mini/run/ must be created so Claude has somewhere to write the report
    await expect(access(join(cwd, '.mini', 'run'))).resolves.toBeUndefined();
  });

  it('refuses the write on a closed phase (done/skipped)', async () => {
    const state = doingStateWithSteps();
    state.phases[0]!.status = 'done';
    await save(state, cwd);

    const r = await applyStepDone('First step', cwd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('phase-closed');

    state.phases[0]!.status = 'skipped';
    await save(state, cwd);

    const r2 = await applyStepDone('First step', cwd);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('phase-closed');
  });

  it('an empty step name returns an error', async () => {
    await save(doingStateWithSteps(), cwd);

    const r = await applyStepDone('   ', cwd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-step-title');
  });
});
