import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, writeProject } from '../state/store.js';
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

const { doPhase } = await import('./do.js');

function stateWithOpenStep(): ProjectState {
  return {
    version: 1,
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
