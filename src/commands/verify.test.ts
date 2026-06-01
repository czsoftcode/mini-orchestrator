import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, writeProject } from '../state/store.js';
import type { ProjectState } from '../state/types.js';

// Interactive verify asks for confirmation before starting Claude — answer
// "yes" so we get all the way to starting the session.
vi.mock('../ui/ask.js', () => ({
  ask: vi.fn(async () => ({ confirm: true })),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

const workWithClaudeMock = vi.fn((..._args: unknown[]) => Promise.resolve({ exitCode: 0 }));
vi.mock('../claude/work.js', () => ({
  workWithClaude: (...args: unknown[]) => workWithClaudeMock(...args),
}));

const { verify } = await import('./verify.js');

function stateWithCurrentPhase(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: 1,
    phases: [
      {
        id: 1,
        title: 'Current phase',
        goal: 'do something visible',
        status: 'doing',
        steps: [{ title: 'step 1', status: 'done' }],
      },
    ],
  };
}

function stateWithLastDone(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [
      { id: 1, title: 'Old phase', goal: 'older', status: 'done' },
      { id: 2, title: 'Last closed phase', goal: 'the freshest one', status: 'done' },
    ],
  };
}

describe('verify command', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-verify-'));
    process.chdir(cwd);
    workWithClaudeMock.mockClear();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('warns and does nothing when there is no project', async () => {
    const r = await verify();

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('no-project');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('does nothing when there is no phase to verify', async () => {
    await writeProject('# Project', cwd);
    await save(
      { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId: null, phases: [] },
      cwd,
    );

    const r = await verify();

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('no-phase-to-verify');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('opens a session for the current phase with the verify tool set', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);

    const r = await verify();

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const [prompt, opts] = workWithClaudeMock.mock.calls[0]! as [string, { allowedTools?: string[] }];
    expect(prompt).toContain('Current phase');
    expect(opts.allowedTools).toEqual(['Read', 'Edit', 'Grep', 'Glob', 'LS']);
  });

  it('falls back to the last closed phase when none is current', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithLastDone(), cwd);

    const r = await verify();

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const [prompt] = workWithClaudeMock.mock.calls[0]! as [string];
    expect(prompt).toContain('Last closed phase');
    expect(prompt).not.toContain('Old phase');
  });
});
