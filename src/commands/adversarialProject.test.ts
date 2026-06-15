import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, writeProject } from '../state/store.js';
import type { ProjectState } from '../state/types.js';

// Interactive adversarial-project asks for confirmation before starting Claude.
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

// The prompt builder (range resolution) is exercised by range.test.ts and
// adversarialProjectContext.test.ts; here we mock it to isolate the command's own
// control flow (null → no session, string → session) from git/range setup.
const buildContextMock = vi.fn((..._args: unknown[]) => Promise.resolve<string | null>(null));
vi.mock('./adversarialProjectContext.js', () => ({
  buildProjectAdversarialContext: (...args: unknown[]) => buildContextMock(...args),
}));

const { adversarialProject } = await import('./adversarialProject.js');

function minimalState(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [
      { id: 1, title: 'Phase one', goal: 'first', status: 'done' },
      { id: 2, title: 'Phase two', goal: 'second', status: 'done' },
    ],
  };
}

describe('adversarial-project command', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-adversarial-project-'));
    process.chdir(cwd);
    workWithClaudeMock.mockReset();
    workWithClaudeMock.mockResolvedValue({ exitCode: 0 });
    askMock.mockReset();
    askMock.mockResolvedValue({ confirm: true });
    buildContextMock.mockReset();
    buildContextMock.mockResolvedValue('REVIEW PROMPT');
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('warns and does nothing when there is no project', async () => {
    const r = await adversarialProject({ fromPhase: 1, toPhase: 2 });

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('no-project');
    expect(buildContextMock).not.toHaveBeenCalled();
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('exits cleanly without a session when the range cannot be resolved (null prompt)', async () => {
    await writeProject('# Project', cwd);
    await save(minimalState(), cwd);
    buildContextMock.mockResolvedValueOnce(null);

    const r = await adversarialProject({ fromPhase: 2, toPhase: 1 });

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('range-error');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('opens a session over the range with a report-only tool set (no Edit)', async () => {
    await writeProject('# Project', cwd);
    await save(minimalState(), cwd);

    const r = await adversarialProject({ fromPhase: 1, toPhase: 2 });

    expect(r.ok).toBe(true);
    expect(buildContextMock).toHaveBeenCalledWith(cwd, { fromPhase: 1, toPhase: 2 });
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const [prompt, opts] = workWithClaudeMock.mock.calls[0]! as [string, { allowedTools?: string[] }];
    expect(prompt).toBe('REVIEW PROMPT');
    // Report-only enforcement: Edit is gone (the reviewer cannot modify code), and
    // the only write it can make is the scoped `mini findings add`. Pin every token.
    expect(opts.allowedTools).toEqual([
      'Read',
      'Grep',
      'Glob',
      'LS',
      'Bash(git diff:*)',
      'Bash(git log:*)',
      'Bash(git show:*)',
      'Bash(mini findings list:*)',
      'Bash(mini findings add:*)',
    ]);
    expect(opts.allowedTools).not.toContain('Edit');
  });

  it('does not start Claude when the user cancels at the confirmation', async () => {
    await writeProject('# Project', cwd);
    await save(minimalState(), cwd);
    askMock.mockResolvedValueOnce({ confirm: false });

    const r = await adversarialProject({ fromPhase: 1, toPhase: 2 });

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('cancelled');
    expect(workWithClaudeMock).not.toHaveBeenCalled();
  });

  it('reports a claude-error when starting the session throws', async () => {
    await writeProject('# Project', cwd);
    await save(minimalState(), cwd);
    workWithClaudeMock.mockRejectedValueOnce(new Error('spawn failed'));

    const r = await adversarialProject({ fromPhase: 1, toPhase: 2 });

    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBe('claude-error');
  });

  it('still returns ok on a non-zero exit code (the session ran, just warned)', async () => {
    await writeProject('# Project', cwd);
    await save(minimalState(), cwd);
    workWithClaudeMock.mockResolvedValueOnce({ exitCode: 2 });

    const r = await adversarialProject({ fromPhase: 1, toPhase: 2 });

    expect(r.ok).toBe(true);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
  });
});
