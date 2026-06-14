import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, writeProject } from '../state/store.js';
import type { ProjectState } from '../state/types.js';

// Interactive adversarial asks for confirmation before starting Claude. The
// default (set per test in beforeEach) answers "yes"; individual tests override
// it to exercise the cancel branch.
const askMock = vi.fn((..._args: unknown[]) => Promise.resolve({ confirm: true }));
vi.mock('../ui/ask.js', () => ({
  ask: (...args: unknown[]) => askMock(...args),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

const workWithClaudeMock = vi.fn((..._args: unknown[]) => Promise.resolve({ exitCode: 0 }));
vi.mock('../claude/work.js', () => ({
  workWithClaude: (...args: unknown[]) => workWithClaudeMock(...args),
}));

const { adversarial } = await import('./adversarial.js');

function stateWithCurrentPhase(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: 1,
    phases: [
      {
        id: 1,
        title: 'Current phase',
        goal: 'do something risky',
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

describe('adversarial command', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-adversarial-'));
    process.chdir(cwd);
    workWithClaudeMock.mockReset();
    workWithClaudeMock.mockResolvedValue({ exitCode: 0 });
    askMock.mockReset();
    askMock.mockResolvedValue({ confirm: true });
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('warns and does nothing when there is no project', async () => {
    const r = await adversarial();

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('no-project');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('does nothing when there is no phase to review', async () => {
    await writeProject('# Project', cwd);
    await save(
      { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId: null, phases: [] },
      cwd,
    );

    const r = await adversarial();

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('no-phase-to-review');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('opens a session for the current phase with the read-only-git tool set', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);

    const r = await adversarial();

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const [prompt, opts] = workWithClaudeMock.mock.calls[0]! as [string, { allowedTools?: string[] }];
    expect(prompt).toContain('Current phase');
    // The novel, risky part of this command: the scoped read-only git Bash grant.
    // A typo in any token would let a broader (or no) Bash through — pin it exactly.
    expect(opts.allowedTools).toEqual([
      'Read',
      'Edit',
      'Grep',
      'Glob',
      'LS',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git show:*)',
    ]);
  });

  it('falls back to the last closed phase when none is current', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithLastDone(), cwd);

    const r = await adversarial();

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const [prompt] = workWithClaudeMock.mock.calls[0]! as [string];
    expect(prompt).toContain('Last closed phase');
    expect(prompt).not.toContain('Old phase');
  });

  it('does not start Claude when the user cancels at the confirmation', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);
    askMock.mockResolvedValueOnce({ confirm: false });

    const r = await adversarial();

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('cancelled');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('reports a claude-error when starting the session throws', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);
    workWithClaudeMock.mockRejectedValueOnce(new Error('spawn failed'));

    const r = await adversarial();

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('claude-error');
  });

  it('still returns ok on a non-zero exit code (the session ran, just warned)', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithCurrentPhase(), cwd);
    workWithClaudeMock.mockResolvedValueOnce({ exitCode: 2 });

    const r = await adversarial();

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
  });
});
