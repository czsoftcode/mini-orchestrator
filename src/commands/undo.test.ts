import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, save } from '../state/store.js';
import type { PhaseAutoCommit, ProjectState } from '../state/types.js';
import { ask } from '../ui/ask.js';
import {
  headParentSha,
  isCleanWorkingTree,
  isGitRepo,
  softResetTo,
} from '../git.js';

vi.mock('../ui/ask.js', () => ({
  ask: vi.fn(async () => ({ confirm: true })),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

vi.mock('../git.js', () => ({
  isGitRepo: vi.fn(async () => false),
  hasChanges: vi.fn(async () => false),
  commitAll: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  currentBranch: vi.fn(async () => null),
  headSha: vi.fn(async () => null),
  headParentSha: vi.fn(async () => null),
  headSubject: vi.fn(async () => null),
  isCleanWorkingTree: vi.fn(async () => true),
  softResetTo: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
}));

const { undo } = await import('./undo.js');

const askMock = vi.mocked(ask);
const isGitRepoMock = vi.mocked(isGitRepo);
const headParentShaMock = vi.mocked(headParentSha);
const isCleanWorkingTreeMock = vi.mocked(isCleanWorkingTree);
const softResetToMock = vi.mocked(softResetTo);

function makeState(phases: ProjectState['phases'], currentPhaseId: number | null): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId,
    phases,
  };
}

const SAMPLE_AUTO_COMMIT: PhaseAutoCommit = {
  preSha: 'a'.repeat(40),
  sha: 'b'.repeat(40),
  subject: 'Phase 1: Done',
};

describe('undo()', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-undo-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockResolvedValue({ confirm: true });
    isGitRepoMock.mockReset();
    isGitRepoMock.mockResolvedValue(false);
    headParentShaMock.mockReset();
    headParentShaMock.mockResolvedValue(null);
    isCleanWorkingTreeMock.mockReset();
    isCleanWorkingTreeMock.mockResolvedValue(true);
    softResetToMock.mockReset();
    softResetToMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('does nothing without .mini', async () => {
    await undo();
    expect(askMock).not.toHaveBeenCalled();
    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('only prints a warning without state.prev.json', async () => {
    await save(makeState([], null), cwd);
    await undo();
    expect(askMock).not.toHaveBeenCalled();
    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('reverts only state without an auto-commit (no soft reset)', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'proposed' }], null),
      cwd,
    );
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );

    await undo();

    expect(askMock).toHaveBeenCalledTimes(1);
    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('with an auto-commit + matching HEAD + clean tree → softReset runs', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    headParentShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.preSha);
    isCleanWorkingTreeMock.mockResolvedValue(true);

    await undo();

    expect(softResetToMock).toHaveBeenCalledTimes(1);
    expect(softResetToMock.mock.calls[0]).toEqual([cwd, SAMPLE_AUTO_COMMIT.preSha]);
  });

  it('user declines — no state revert and no soft reset', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    headParentShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.preSha);
    isCleanWorkingTreeMock.mockResolvedValue(true);
    askMock.mockResolvedValue({ confirm: false });

    await undo();

    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('HEAD has moved → undo only state, the commit is not dropped', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    // HEAD is elsewhere — the user committed something else in the meantime.
    headParentShaMock.mockResolvedValue('c'.repeat(40));
    isCleanWorkingTreeMock.mockResolvedValue(true);

    await undo();

    expect(askMock).toHaveBeenCalledTimes(1);
    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('dirty working tree → undo only state, the commit is not dropped', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    headParentShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.preSha);
    isCleanWorkingTreeMock.mockResolvedValue(false);

    await undo();

    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('not a git repo → undo only state, the commit is not dropped', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(false);

    await undo();

    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('soft reset fails → state undo still runs, only prints a warning', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    headParentShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.preSha);
    isCleanWorkingTreeMock.mockResolvedValue(true);
    softResetToMock.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'fatal: cannot reset',
    });

    await undo();

    expect(softResetToMock).toHaveBeenCalledTimes(1);
  });

  it('--dry-run only previews — no prompt, no soft reset, state stays', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    headParentShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.preSha);
    isCleanWorkingTreeMock.mockResolvedValue(true);

    await undo({ dryRun: true });

    expect(askMock).not.toHaveBeenCalled();
    expect(softResetToMock).not.toHaveBeenCalled();
    // State is untouched — still the "current" (un-reverted) version.
    const state = await load(cwd);
    expect(state.currentPhaseId).toBe(null);
    expect(state.phases[0]?.status).toBe('done');
  });

  it('--yes skips the confirm and applies (soft reset runs without asking)', async () => {
    await save(
      makeState([{ id: 1, title: 'A', status: 'doing' }], 1),
      cwd,
    );
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'done', autoCommit: SAMPLE_AUTO_COMMIT }],
        null,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    headParentShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.preSha);
    isCleanWorkingTreeMock.mockResolvedValue(true);

    await undo({ yes: true });

    expect(askMock).not.toHaveBeenCalled();
    expect(softResetToMock).toHaveBeenCalledTimes(1);
    // State reverted by one step — back to the "doing" version.
    const state = await load(cwd);
    expect(state.currentPhaseId).toBe(1);
    expect(state.phases[0]?.status).toBe('doing');
  });
});
