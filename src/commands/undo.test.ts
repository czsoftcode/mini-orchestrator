import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save } from '../state/store.js';
import type { PhaseAutoCommit, ProjectState } from '../state/types.js';
import { ask } from '../ui/ask.js';
import {
  headSha,
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
  headSubject: vi.fn(async () => null),
  isCleanWorkingTree: vi.fn(async () => true),
  softResetTo: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
}));

const { undo } = await import('./undo.js');

const askMock = vi.mocked(ask);
const isGitRepoMock = vi.mocked(isGitRepo);
const headShaMock = vi.mocked(headSha);
const isCleanWorkingTreeMock = vi.mocked(isCleanWorkingTree);
const softResetToMock = vi.mocked(softResetTo);

function makeState(phases: ProjectState['phases'], currentPhaseId: number | null): ProjectState {
  return {
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId,
    phases,
  };
}

const SAMPLE_AUTO_COMMIT: PhaseAutoCommit = {
  preSha: 'a'.repeat(40),
  sha: 'b'.repeat(40),
  subject: 'Fáze 1: Hotovo',
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
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    isCleanWorkingTreeMock.mockReset();
    isCleanWorkingTreeMock.mockResolvedValue(true);
    softResetToMock.mockReset();
    softResetToMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('bez .mini ani nic neudělá', async () => {
    await undo();
    expect(askMock).not.toHaveBeenCalled();
    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('bez state.prev.json jen vypíše varování', async () => {
    await save(makeState([], null), cwd);
    await undo();
    expect(askMock).not.toHaveBeenCalled();
    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('bez auto-commitu vrátí jen state (žádný soft reset)', async () => {
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

  it('s auto-commitem + HEAD sedí + čistý strom → softReset proběhne', async () => {
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
    headShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.sha);
    isCleanWorkingTreeMock.mockResolvedValue(true);

    await undo();

    expect(softResetToMock).toHaveBeenCalledTimes(1);
    expect(softResetToMock.mock.calls[0]).toEqual([cwd, SAMPLE_AUTO_COMMIT.preSha]);
  });

  it('uživatel zamítne — žádný state revert ani soft reset', async () => {
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
    headShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.sha);
    isCleanWorkingTreeMock.mockResolvedValue(true);
    askMock.mockResolvedValue({ confirm: false });

    await undo();

    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('HEAD se posunul → undo jen state, commit nezruší', async () => {
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
    // HEAD je jinde — uživatel mezitím commitnul něco dalšího.
    headShaMock.mockResolvedValue('c'.repeat(40));
    isCleanWorkingTreeMock.mockResolvedValue(true);

    await undo();

    expect(askMock).toHaveBeenCalledTimes(1);
    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('dirty working tree → undo jen state, commit nezruší', async () => {
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
    headShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.sha);
    isCleanWorkingTreeMock.mockResolvedValue(false);

    await undo();

    expect(softResetToMock).not.toHaveBeenCalled();
  });

  it('není git repo → undo jen state, commit nezruší', async () => {
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

  it('soft reset selže → undo state stále proběhne, jen vypíše warning', async () => {
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
    headShaMock.mockResolvedValue(SAMPLE_AUTO_COMMIT.sha);
    isCleanWorkingTreeMock.mockResolvedValue(true);
    softResetToMock.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'fatal: nelze resetovat',
    });

    await undo();

    expect(softResetToMock).toHaveBeenCalledTimes(1);
  });
});
