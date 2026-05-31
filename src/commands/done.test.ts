import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { advanceToNextPhase, applyDone, buildPhaseCommitMessage, done } from './done.js';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import { load, save } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { isInteractive } from '../ui/interactive.js';
import { commitAll, hasChanges, headSha, isGitRepo, push } from '../git.js';
import { writePhaseMemory } from './writeMemory.js';

// We replace `ask` with `vi.fn` so we can switch the implementation in tests —
// mostly it should throw (auto mode must not touch it), but the fallback tests
// switch in their own answer.
vi.mock('../ui/ask.js', () => ({
  ask: vi.fn(async () => {
    throw new Error('ask() must not be called in auto mode');
  }),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

// We mock the terminal interactivity — tests run without a TTY, but most verify
// tests exercise the interactive path (ask), so by default we pretend there is a
// terminal. The W3 test switches it to false (non-interactive environment).
vi.mock('../ui/interactive.js', () => ({
  isInteractive: vi.fn(() => true),
}));

// We mock the git module — by default it behaves like "we are not in a git
// repo", so existing tests (running in `tmpdir`) don't activate the commit
// logic. Specific tests switch the git functions via `mockResolvedValueOnce`.
vi.mock('../git.js', () => ({
  isGitRepo: vi.fn(async () => false),
  hasChanges: vi.fn(async () => false),
  commitAll: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  push: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  createTag: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  pushTag: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  currentBranch: vi.fn(async () => null),
  headSha: vi.fn(async () => null),
  headSubject: vi.fn(async () => null),
  isCleanWorkingTree: vi.fn(async () => true),
  softResetTo: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
}));

// We mock the memory write — tests must not run a real Claude session.
// No-op by default; specific tests spy on it via `writePhaseMemoryMock`.
vi.mock('./writeMemory.js', () => ({
  writePhaseMemory: vi.fn(async () => {}),
}));

const askMock = vi.mocked(ask);
const isInteractiveMock = vi.mocked(isInteractive);
const isGitRepoMock = vi.mocked(isGitRepo);
const hasChangesMock = vi.mocked(hasChanges);
const commitAllMock = vi.mocked(commitAll);
const headShaMock = vi.mocked(headSha);
const pushMock = vi.mocked(push);
const writePhaseMemoryMock = vi.mocked(writePhaseMemory);

async function writeRunReport(cwd: string, phaseId: number, body: string): Promise<void> {
  await ensureRunDir(cwd);
  await writeFile(runReportPath(cwd, phaseId), body, 'utf-8');
}

function makeState(phases: Phase[], currentPhaseId: number | null): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId,
    phases,
  };
}

describe('advanceToNextPhase', () => {
  it('moves to the first proposed phase after the current one is finished', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'done' },
        { id: 2, title: 'B', status: 'proposed' },
      ],
      1,
    );

    const next = advanceToNextPhase(state);

    expect(next).not.toBeNull();
    expect(next?.id).toBe(2);
    expect(state.currentPhaseId).toBe(2);
  });

  it('moves to the first planned phase as well', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'done' },
        { id: 2, title: 'B', status: 'planned', steps: [] },
      ],
      1,
    );

    const next = advanceToNextPhase(state);

    expect(next?.id).toBe(2);
    expect(state.currentPhaseId).toBe(2);
  });

  it('picks the first candidate in phase order, not by id', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'done' },
        { id: 5, title: 'E', status: 'planned' },
        { id: 3, title: 'C', status: 'proposed' },
      ],
      1,
    );

    const next = advanceToNextPhase(state);

    // 5 comes before 3 in the array, so it wins even though its id is higher.
    expect(next?.id).toBe(5);
    expect(state.currentPhaseId).toBe(5);
  });

  it('skips the current phase even if it is still proposed/planned', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'planned' },
        { id: 2, title: 'B', status: 'proposed' },
      ],
      1,
    );

    const next = advanceToNextPhase(state);

    expect(next?.id).toBe(2);
    expect(state.currentPhaseId).toBe(2);
  });

  it('ignores done/doing/skipped phases as candidates', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'done' },
        { id: 2, title: 'B', status: 'doing' },
        { id: 3, title: 'C', status: 'skipped' },
        { id: 4, title: 'D', status: 'planned' },
      ],
      1,
    );

    const next = advanceToNextPhase(state);

    expect(next?.id).toBe(4);
    expect(state.currentPhaseId).toBe(4);
  });

  it('returns null and clears currentPhaseId when no next phase exists', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'done' },
        { id: 2, title: 'B', status: 'skipped' },
      ],
      1,
    );

    const next = advanceToNextPhase(state);

    expect(next).toBeNull();
    expect(state.currentPhaseId).toBeNull();
  });

  it('returns null on an empty project', () => {
    const state = makeState([], null);

    const next = advanceToNextPhase(state);

    expect(next).toBeNull();
    expect(state.currentPhaseId).toBeNull();
  });

  it('finds a candidate even when currentPhaseId is null (e.g. resume from finished project)', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'done' },
        { id: 2, title: 'B', status: 'proposed' },
      ],
      null,
    );

    const next = advanceToNextPhase(state);

    expect(next?.id).toBe(2);
    expect(state.currentPhaseId).toBe(2);
  });

  it('picks the very first proposed phase when multiple candidates exist', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'done' },
        { id: 2, title: 'B', status: 'proposed' },
        { id: 3, title: 'C', status: 'proposed' },
        { id: 4, title: 'D', status: 'planned' },
      ],
      1,
    );

    const next = advanceToNextPhase(state);

    expect(next?.id).toBe(2);
    expect(state.currentPhaseId).toBe(2);
  });

  it('closes an orphaned doing parent when its sub-phase is done (W1)', () => {
    // Parent 21 got stuck in doing after a block-verify; sub-phase 21.1 is now done.
    // advanceToNextPhase must close the parent as done and move on to 22.
    const state = makeState(
      [
        { id: 21, title: 'Parent', status: 'doing' },
        { id: 21.1, title: 'Fix', status: 'done', steps: [] },
        { id: 22, title: 'Next', status: 'planned' },
      ],
      21.1,
    );

    const next = advanceToNextPhase(state);

    const parent = state.phases.find((p) => p.id === 21);
    expect(parent?.status).toBe('done');
    expect(parent?.completedAt).toBeTypeOf('string');
    expect(next?.id).toBe(22);
    expect(state.currentPhaseId).toBe(22);
  });

  it('does not close a doing parent while it has an unclosed sub-phase (W1)', () => {
    const state = makeState(
      [
        { id: 21, title: 'Parent', status: 'doing' },
        { id: 21.1, title: 'Fix A', status: 'done', steps: [] },
        { id: 21.2, title: 'Fix B', status: 'planned', steps: [] },
      ],
      21.1,
    );

    const next = advanceToNextPhase(state);

    expect(state.phases.find((p) => p.id === 21)?.status).toBe('doing');
    expect(next?.id).toBe(21.2);
    expect(state.currentPhaseId).toBe(21.2);
  });

  it('does not close a regular doing phase without sub-phases', () => {
    const state = makeState(
      [
        { id: 1, title: 'A', status: 'doing' },
        { id: 2, title: 'B', status: 'planned' },
      ],
      1,
    );

    advanceToNextPhase(state);

    expect(state.phases.find((p) => p.id === 1)?.status).toBe('doing');
  });

  it('moves to a float-ID sub-phase inserted right after the parent', () => {
    // Sub-phase 21.1 sits physically after parent 21 (doing) and before phase 22.
    // advanceToNextPhase must pick it as the first planned/proposed in order.
    const state = makeState(
      [
        { id: 21, title: 'Parent', status: 'doing' },
        { id: 21.1, title: 'Fix', status: 'planned', steps: [] },
        { id: 22, title: 'Next', status: 'planned' },
      ],
      21,
    );

    const next = advanceToNextPhase(state);

    expect(next?.id).toBe(21.1);
    expect(state.currentPhaseId).toBe(21.1);
  });
});

describe('done({ auto: true })', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-auto-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockImplementation(async () => {
      throw new Error('ask() must not be called in auto mode');
    });
    isGitRepoMock.mockReset();
    isGitRepoMock.mockResolvedValue(false);
    hasChangesMock.mockReset();
    hasChangesMock.mockResolvedValue(false);
    commitAllMock.mockReset();
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    writePhaseMemoryMock.mockReset();
    writePhaseMemoryMock.mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns no-project when there is no .mini state', async () => {
    const r = await done({ auto: true });
    expect(r).toEqual({ ok: false, reason: 'no-project' });
  });

  it('returns no-current-phase when currentPhaseId is null', async () => {
    await save(makeState([], null), cwd);

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: false, reason: 'no-current-phase' });
  });

  it('returns inconsistent-state when currentPhaseId references a missing phase', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing' }], 99), cwd);

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: false, reason: 'inconsistent-state' });
  });

  it('returns phase-done when the current phase is already finished', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'done' }], 1), cwd);

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: false, reason: 'phase-done' });
  });

  it('applies statuses from the report and leaves the phase doing when the report has a todo step', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'doing' },
              { title: 'step 2', status: 'todo' },
            ],
          },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: partial
steps:
  - title: "step 1"
    status: done
  - title: "step 2"
    status: todo
---

I didn't finish step 2.
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true });
    const loaded = await load(cwd);
    const phase = loaded.phases.find((p) => p.id === 1);
    expect(phase?.status).toBe('doing');
    expect(phase?.completedAt).toBeUndefined();
    expect(phase?.steps?.[0]?.status).toBe('done');
    expect(phase?.steps?.[1]?.status).toBe('todo');
    expect(loaded.currentPhaseId).toBe(1);
  });

  it('finalizes the phase and moves on when the report marks all steps as done', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'done' },
              { title: 'step 2', status: 'doing' },
            ],
          },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "step 1"
    status: done
  - title: "step 2"
    status: done
---
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 2 });
    const loaded = await load(cwd);
    const phase1 = loaded.phases.find((p) => p.id === 1);
    expect(phase1?.status).toBe('done');
    expect(phase1?.completedAt).toBeTypeOf('string');
    expect(phase1?.steps?.[1]?.status).toBe('done');
    expect(phase1?.humanNotes).toBeUndefined();
    expect(loaded.currentPhaseId).toBe(2);
  });

  it('accepts skipped steps in the report and finalizes the phase when nothing unclosed remains', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'done' },
              { title: 'step 2', status: 'todo' },
              { title: 'step 3', status: 'todo' },
            ],
          },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "step 1"
    status: done
  - title: "step 2"
    status: skipped
  - title: "step 3"
    status: skipped
---
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 2 });
    const loaded = await load(cwd);
    const phase1 = loaded.phases.find((p) => p.id === 1);
    expect(phase1?.status).toBe('done');
    expect(phase1?.completedAt).toBeTypeOf('string');
    expect(phase1?.steps?.[1]?.status).toBe('skipped');
    expect(phase1?.steps?.[2]?.status).toBe('skipped');
    expect(loaded.currentPhaseId).toBe(2);
  });

  it('a blocked status in the report keeps the step as todo and does not close the phase', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'done' },
              { title: 'step 2', status: 'doing' },
            ],
          },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: blocked
steps:
  - title: "step 1"
    status: done
  - title: "step 2"
    status: blocked
---

Step 2 requires an API key I don't have.
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true });
    const loaded = await load(cwd);
    const phase = loaded.phases.find((p) => p.id === 1);
    expect(phase?.status).toBe('doing');
    expect(phase?.completedAt).toBeUndefined();
    expect(phase?.steps?.[0]?.status).toBe('done');
    expect(phase?.steps?.[1]?.status).toBe('todo');
    expect(loaded.currentPhaseId).toBe(1);
  });

  it('finalizes a phase without steps when the report has verdict=done', async () => {
    await save(
      makeState(
        [
          { id: 1, title: 'A', status: 'doing' },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps: []
---
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 2 });
    const loaded = await load(cwd);
    const phase1 = loaded.phases.find((p) => p.id === 1);
    expect(phase1?.status).toBe('done');
    expect(phase1?.completedAt).toBeTypeOf('string');
    expect(loaded.currentPhaseId).toBe(2);
  });

  it('does not close a phase without steps when the report has verdict=partial', async () => {
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'doing' }],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: partial
steps: []
---

I didn't finish.
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true });
    const loaded = await load(cwd);
    expect(loaded.phases[0]?.status).toBe('doing');
    expect(loaded.currentPhaseId).toBe(1);
  });

  it('clears currentPhaseId when there is no next phase after finalization', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "step 1"
    status: done
---
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: null });
    const loaded = await load(cwd);
    expect(loaded.phases[0]?.status).toBe('done');
    expect(loaded.currentPhaseId).toBeNull();
  });

  it('persists the state to disk so the next load sees it', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "step 1"
    status: done
---
`,
    );

    await done({ auto: true });

    const reloaded = await load(cwd);
    expect(reloaded.phases.find((p) => p.id === 1)?.status).toBe('done');
    expect(reloaded.currentPhaseId).toBe(2);
  });
});

describe('done({ auto: true }) — fallback to interactive mode', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-auto-fallback-'));
    process.chdir(cwd);
    askMock.mockReset();
    isGitRepoMock.mockReset();
    isGitRepoMock.mockResolvedValue(false);
    hasChangesMock.mockReset();
    hasChangesMock.mockResolvedValue(false);
    commitAllMock.mockReset();
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    writePhaseMemoryMock.mockReset();
    writePhaseMemoryMock.mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('missing report → interactive fallback (the user decides per step)', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'doing' },
              { title: 'step 2', status: 'todo' },
            ],
          },
        ],
        1,
      ),
      cwd,
    );

    // Interactive done() with a doing step and remaining todos: asks only about
    // the doing step's outcome (1 ask) and returns with a hint to `mini do`.
    askMock.mockResolvedValueOnce({ outcome: 'done' });

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true });
    expect(askMock).toHaveBeenCalledTimes(1);
    const loaded = await load(cwd);
    const phase = loaded.phases.find((p) => p.id === 1);
    expect(phase?.steps?.[0]?.status).toBe('done');
    expect(phase?.steps?.[1]?.status).toBe('todo');
    expect(phase?.status).toBe('doing');
  });

  it('broken report → interactive fallback, marks nothing blindly', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(cwd, 1, 'this is not a valid report\n');

    // outcome for the "doing" step → "done", because it was the last one, phase finalization (empty notes).
    askMock
      .mockResolvedValueOnce({ outcome: 'done' })
      .mockResolvedValueOnce({ outcome: 'done' })
      .mockResolvedValueOnce({ notes: '' });

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(askMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const loaded = await load(cwd);
    expect(loaded.phases[0]?.status).toBe('done');
  });
});

describe('buildPhaseCommitMessage', () => {
  it('subject contains both the id and the title', () => {
    const msg = buildPhaseCommitMessage({ id: 7, title: 'Something done', status: 'done' });
    expect(msg).toBe('Phase 7: Something done');
  });

  it('adds a body with humanNotes when present', () => {
    const msg = buildPhaseCommitMessage({
      id: 3,
      title: 'With notes',
      status: 'done',
      humanNotes: 'Works, but the plan should be simplified further.',
    });
    expect(msg).toBe(
      'Phase 3: With notes\n\nWorks, but the plan should be simplified further.\n',
    );
  });

  it('ignores empty / whitespace humanNotes', () => {
    const msg = buildPhaseCommitMessage({
      id: 1,
      title: 'No notes',
      status: 'done',
      humanNotes: '   \n  ',
    });
    expect(msg).toBe('Phase 1: No notes');
  });
});

describe('commit after phase finalization', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-commit-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockImplementation(async () => {
      throw new Error('ask() must not be called in auto mode');
    });
    isGitRepoMock.mockReset();
    hasChangesMock.mockReset();
    commitAllMock.mockReset();
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    writePhaseMemoryMock.mockReset();
    writePhaseMemoryMock.mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  async function setupDoneAutoPhase(): Promise<void> {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'Phase to commit',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "step 1"
    status: done
---
`,
    );
  }

  it('commits the phase when it is `done`, it is a git repo, and there are changes', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).toHaveBeenCalledTimes(1);
    const [calledCwd, msg] = commitAllMock.mock.calls[0]!;
    expect(calledCwd).toBe(cwd);
    expect(msg).toBe('Phase 1: Phase to commit');
  });

  it('saves `phase.autoCommit` (preSha, subject — without its own sha) after a successful commit', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    // headSha is called only once — preSha BEFORE the commit. The commit's own
    // sha is not stored (the commit also carries state.json with the record, it
    // would depend on itself).
    headShaMock.mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    const reloaded = await load(cwd);
    const phase = reloaded.phases[0];
    expect(phase?.autoCommit).toEqual({
      preSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      subject: 'Phase 1: Phase to commit',
    });
    expect(phase?.autoCommit).not.toHaveProperty('sha');
  });

  it('memory, graph, and final state are written BEFORE the commit (nothing hangs after `done`)', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    headShaMock.mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    await done({ auto: true });

    // The memory record must happen BEFORE the single commit, so it lands in it.
    expect(writePhaseMemoryMock).toHaveBeenCalledTimes(1);
    expect(commitAllMock).toHaveBeenCalledTimes(1);
    const memoryOrder = writePhaseMemoryMock.mock.invocationCallOrder[0]!;
    const commitOrder = commitAllMock.mock.invocationCallOrder[0]!;
    expect(memoryOrder).toBeLessThan(commitOrder);
  });

  it('a failed commit does not write `phase.autoCommit`', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({ ok: false, stdout: '', stderr: 'fail' });
    headShaMock.mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    await done({ auto: true });

    const reloaded = await load(cwd);
    expect(reloaded.phases[0]?.autoCommit).toBeUndefined();
  });

  it('skips the commit when cwd is not a git repo', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(false);

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).not.toHaveBeenCalled();
  });

  it('skips the commit when there are no changes', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(false);

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).not.toHaveBeenCalled();
  });

  it('a failed commit (`ok: false`) does not crash done — the state is already saved', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'fatal: commit error',
    });

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).toHaveBeenCalledTimes(1);
    // the phase status is advanced anyway — the user finishes the commit manually
    const reloaded = await load(cwd);
    expect(reloaded.phases[0]?.status).toBe('done');
  });

  it('a skipped phase is not committed', async () => {
    // Setup: the single step is `doing`, but in interactive done we choose `skip`.
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'Deferred phase',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    // 1st ask: step → "skip", 2nd ask: phase → "skip", 3rd ask: notes → ''
    // (skipping the step finalizes it, then the run reaches finalizePhase, where
    //  outcome=skip and notes aren't needed, but done asks for them anyway)
    askMock
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ notes: '' });

    await done();

    expect(commitAllMock).not.toHaveBeenCalled();
  });

  it('interactive force-done makes a commit with humanNotes in the body', async () => {
    await save(
      makeState(
        [
          {
            id: 2,
            title: 'Phase with a note',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'done' },
              { title: 'step 2', status: 'todo' },
            ],
          },
        ],
        2,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    askMock
      // done() sees remainingSteps > 0 → prompts for a "decision"; we pick force-done
      .mockResolvedValueOnce({ decision: 'force-done' })
      // collectNotesAndSave then asks for a note
      .mockResolvedValueOnce({ notes: 'Keep this.' });

    await done();

    expect(commitAllMock).toHaveBeenCalledTimes(1);
    const [, msg] = commitAllMock.mock.calls[0]!;
    expect(msg).toBe('Phase 2: Phase with a note\n\nKeep this.\n');
  });
});

describe('memory write after phase finalization', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-memory-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockImplementation(async () => {
      throw new Error('ask() must not be called in auto mode');
    });
    isGitRepoMock.mockReset();
    isGitRepoMock.mockResolvedValue(false);
    hasChangesMock.mockReset();
    hasChangesMock.mockResolvedValue(false);
    commitAllMock.mockReset();
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    writePhaseMemoryMock.mockReset();
    writePhaseMemoryMock.mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  async function setupDonePhaseViaAuto(): Promise<void> {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'Phase into memory',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "step 1"
    status: done
---
`,
    );
  }

  it('calls writePhaseMemory after phase finalization in auto mode', async () => {
    await setupDonePhaseViaAuto();

    await done({ auto: true });

    expect(writePhaseMemoryMock).toHaveBeenCalledTimes(1);
    const [calledPhase, , calledCwd, calledOpts] = writePhaseMemoryMock.mock.calls[0]!;
    expect(calledPhase.id).toBe(1);
    expect(calledPhase.status).toBe('done');
    expect(calledCwd).toBe(cwd);
    expect(calledOpts).toEqual({ hasAutoCommit: false });
  });

  it('passes hasAutoCommit=true when the auto-commit happened', async () => {
    await setupDonePhaseViaAuto();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    headShaMock
      .mockResolvedValueOnce('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      .mockResolvedValueOnce('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    await done({ auto: true });

    expect(writePhaseMemoryMock).toHaveBeenCalledTimes(1);
    const [calledPhase, , , calledOpts] = writePhaseMemoryMock.mock.calls[0]!;
    expect(calledPhase.autoCommit).toBeDefined();
    expect(calledOpts).toEqual({ hasAutoCommit: true });
  });

  it('does not call writePhaseMemory for a skipped phase', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'Deferred phase',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    // Interactive path: step → skip, phase → skip, notes → ''
    askMock
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ notes: '' });

    await done();

    expect(writePhaseMemoryMock).not.toHaveBeenCalled();
  });

  it('calls writePhaseMemory in the interactive force-done path too', async () => {
    await save(
      makeState(
        [
          {
            id: 4,
            title: 'Force-done phase',
            status: 'doing',
            steps: [
              { title: 'step 1', status: 'done' },
              { title: 'step 2', status: 'todo' },
            ],
          },
        ],
        4,
      ),
      cwd,
    );
    askMock
      .mockResolvedValueOnce({ decision: 'force-done' })
      .mockResolvedValueOnce({ notes: '' });

    await done();

    expect(writePhaseMemoryMock).toHaveBeenCalledTimes(1);
    const [calledPhase] = writePhaseMemoryMock.mock.calls[0]!;
    expect(calledPhase.id).toBe(4);
    expect(calledPhase.status).toBe('done');
  });

  it('calls writePhaseMemory in interactive finalizePhase ("Done, works")', async () => {
    await save(
      makeState(
        [
          {
            id: 5,
            title: 'Interactive done phase',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'done' }],
          },
        ],
        5,
      ),
      cwd,
    );
    // No unclosed steps → straight to finalizePhase: outcome → done, notes → ''
    askMock
      .mockResolvedValueOnce({ outcome: 'done' })
      .mockResolvedValueOnce({ notes: '' });

    await done();

    expect(writePhaseMemoryMock).toHaveBeenCalledTimes(1);
    const [calledPhase] = writePhaseMemoryMock.mock.calls[0]!;
    expect(calledPhase.id).toBe(5);
  });

});

describe('done({ auto: true }) — graph regeneration', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-graph-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockImplementation(async () => {
      throw new Error('ask() must not be called in auto mode');
    });
    isGitRepoMock.mockReset();
    isGitRepoMock.mockResolvedValue(false);
    hasChangesMock.mockReset();
    hasChangesMock.mockResolvedValue(false);
    commitAllMock.mockReset();
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    writePhaseMemoryMock.mockReset();
    writePhaseMemoryMock.mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('regenerates .mini/graph/ + index after phase finalization in a TS project', async () => {
    await writeFile(join(cwd, 'tsconfig.json'), '{}', 'utf-8');
    await writeFile(join(cwd, 'a.ts'), 'export const a = 1;', 'utf-8');
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'F',
            status: 'doing',
            steps: [{ title: 'k1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "k1"
    status: done
---
`,
    );

    await done({ auto: true });

    const graph = await readFile(join(cwd, '.mini', 'graph', 'a.ts.md'), 'utf-8');
    expect(graph).toContain('## a.ts');
    expect(graph).toContain('const a');
    const index = JSON.parse(await readFile(join(cwd, '.mini', 'graph.json'), 'utf-8'));
    expect(index.files.map((f: { path: string }) => f.path)).toContain('a.ts');
  });

  it('skips regeneration in a non-TS project', async () => {
    await writeFile(join(cwd, 'package.json'), '{}', 'utf-8');
    await writeFile(join(cwd, 'styles.css'), 'body{}', 'utf-8');
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'F',
            status: 'doing',
            steps: [{ title: 'k1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "k1"
    status: done
---
`,
    );

    await done({ auto: true });

    await expect(access(join(cwd, '.mini', 'graph.json'))).rejects.toThrow();
  });
});

describe('done({ auto: true }) — verify body', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-verify-'));
    process.chdir(cwd);
    askMock.mockReset();
    isInteractiveMock.mockReset();
    isInteractiveMock.mockReturnValue(true);
    isGitRepoMock.mockReset();
    isGitRepoMock.mockResolvedValue(false);
    hasChangesMock.mockReset();
    hasChangesMock.mockResolvedValue(false);
    commitAllMock.mockReset();
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    writePhaseMemoryMock.mockReset();
    writePhaseMemoryMock.mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  async function setupPhaseWithVerify(verifyYaml: string): Promise<void> {
    await save(
      makeState(
        [
          {
            id: 21,
            title: 'Phase with verification',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'done' }],
          },
          { id: 22, title: 'Next', status: 'proposed' },
        ],
        21,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      21,
      `---
phase: 21
verdict: done
steps:
  - title: "step 1"
    status: done
${verifyYaml}---
`,
    );
  }

  it('pass on all items → the phase closes and moves on', async () => {
    await setupPhaseWithVerify(
      `verify:
  - title: Visual check of the button
  - title: UX flow
`,
    );
    askMock
      .mockResolvedValueOnce({ answer: 'pass' })
      .mockResolvedValueOnce({ answer: 'pass' });

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 22 });
    expect(askMock).toHaveBeenCalledTimes(2);
    const loaded = await load(cwd);
    expect(loaded.phases.find((p) => p.id === 21)?.status).toBe('done');
    expect(loaded.currentPhaseId).toBe(22);
  });

  it('skip → the phase closes (the user takes responsibility)', async () => {
    await setupPhaseWithVerify(
      `verify:
  - title: Visual check
`,
    );
    askMock.mockResolvedValueOnce({ answer: 'skip' });

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 22 });
    const loaded = await load(cwd);
    expect(loaded.phases.find((p) => p.id === 21)?.status).toBe('done');
  });

  it('issue → does not close the phase, returns ok:false (the user fixes it and closes again)', async () => {
    await setupPhaseWithVerify(
      `verify:
  - title: The button is crooked
`,
    );
    askMock.mockResolvedValueOnce({ answer: 'issue' });

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: false, reason: 'verify-issue' });
    const loaded = await load(cwd);
    const phase = loaded.phases.find((p) => p.id === 21);
    expect(phase?.status).toBe('doing');
    expect(phase?.completedAt).toBeUndefined();
    expect(loaded.currentPhaseId).toBe(21);
    // no sub-phase was created
    expect(loaded.phases.some((p) => p.id === 21.1)).toBe(false);
  });

  it('block → creates a fix sub-phase with a float ID and moves onto it', async () => {
    await setupPhaseWithVerify(
      `verify:
  - title: The page crashes on mobile
    detail: OK on desktop, mobile untested
  - title: A small text detail
`,
    );
    // 1st item → block, 2nd item → issue (a blocker takes precedence)
    askMock
      .mockResolvedValueOnce({ answer: 'block' })
      .mockResolvedValueOnce({ answer: 'issue' });

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 21.1 });
    const loaded = await load(cwd);

    // the parent did NOT close
    const parent = loaded.phases.find((p) => p.id === 21);
    expect(parent?.status).toBe('doing');
    expect(parent?.completedAt).toBeUndefined();

    // sub-phase 21.1 was created right after the parent
    const idxParent = loaded.phases.findIndex((p) => p.id === 21);
    const idxSub = loaded.phases.findIndex((p) => p.id === 21.1);
    expect(idxSub).toBe(idxParent + 1);

    const sub = loaded.phases[idxSub];
    expect(sub?.status).toBe('planned');
    expect(sub?.steps).toEqual([
      { title: 'The page crashes on mobile', status: 'todo', notes: 'OK on desktop, mobile untested' },
    ]);
    expect(loaded.currentPhaseId).toBe(21.1);

    // the blocker did not trigger a commit or memory (the phase did not close)
    expect(commitAllMock).not.toHaveBeenCalled();
    expect(writePhaseMemoryMock).not.toHaveBeenCalled();
  });

  it('a second blocker gets ID 21.2 when 21.1 already exists', async () => {
    await save(
      makeState(
        [
          {
            id: 21,
            title: 'Parent',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'done' }],
          },
          { id: 21.1, title: 'Fix: Parent', status: 'done', steps: [] },
        ],
        21,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      21,
      `---
phase: 21
verdict: done
steps:
  - title: "step 1"
    status: done
verify:
  - title: Another blocker
---
`,
    );
    askMock.mockResolvedValueOnce({ answer: 'block' });

    const r = await done({ auto: true });

    const loaded = await load(cwd);
    expect(loaded.phases.some((p) => p.id === 21.2)).toBe(true);
    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 21.2 });
  });

  it('a report without a verify field passes the closing unchanged (ask is not called)', async () => {
    askMock.mockImplementation(async () => {
      throw new Error('ask() must not be called for a report without verify');
    });
    await save(
      makeState(
        [
          {
            id: 21,
            title: 'Without verify',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'done' }],
          },
          { id: 22, title: 'Next', status: 'proposed' },
        ],
        21,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      21,
      `---
phase: 21
verdict: done
steps:
  - title: "step 1"
    status: done
---
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 22 });
    expect(askMock).not.toHaveBeenCalled();
  });

  it('without a TTY verify does not silently pass — does not close the phase and returns verify-needs-human (W3)', async () => {
    isInteractiveMock.mockReturnValue(false);
    askMock.mockImplementation(async () => {
      throw new Error('ask() must not be called in a non-interactive environment');
    });
    await setupPhaseWithVerify(
      `verify:
  - title: Visual check of the button
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: false, reason: 'verify-needs-human' });
    expect(askMock).not.toHaveBeenCalled();
    const loaded = await load(cwd);
    const phase = loaded.phases.find((p) => p.id === 21);
    expect(phase?.status).toBe('doing');
    expect(phase?.completedAt).toBeUndefined();
    expect(loaded.currentPhaseId).toBe(21);
  });

  it('a repeated done does not replay already resolved verify items (W4)', async () => {
    // 1st pass: one item pass, the other issue → the phase does not close.
    await setupPhaseWithVerify(
      `verify:
  - title: Visual check
  - title: A small text detail
`,
    );
    askMock
      .mockResolvedValueOnce({ answer: 'pass' })
      .mockResolvedValueOnce({ answer: 'issue' });

    const r1 = await done({ auto: true });
    expect(r1).toEqual({ ok: false, reason: 'verify-issue' });

    const afterFirst = await load(cwd);
    const phaseAfterFirst = afterFirst.phases.find((p) => p.id === 21);
    expect(phaseAfterFirst?.status).toBe('doing');
    expect(phaseAfterFirst?.resolvedVerify).toEqual(['Visual check']);

    // 2nd pass over the same report: the already resolved item is not offered,
    // it asks only about the remaining one (previously issue, now fixed → pass) → the phase closes.
    askMock.mockReset();
    askMock.mockResolvedValueOnce({ answer: 'pass' });

    const r2 = await done({ auto: true });

    expect(askMock).toHaveBeenCalledTimes(1);
    expect(r2).toEqual({ ok: true, phaseAdvanced: true, nextPhaseId: 22 });
    const loaded = await load(cwd);
    expect(loaded.phases.find((p) => p.id === 21)?.status).toBe('done');
    expect(loaded.currentPhaseId).toBe(22);
  });

});

describe('CHANGELOG stamp on release', () => {
  let cwd: string;
  let prevCwd: string;

  const CHANGELOG = `# Changelog

## [Unreleased]
### Added
- new feature

## [0.9.0] - 2026-01-01
### Added
- older thing
`;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-changelog-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockImplementation(async () => {
      throw new Error('ask() must not be called in auto mode');
    });
    isGitRepoMock.mockReset();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockReset();
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockReset();
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    headShaMock.mockReset();
    headShaMock.mockResolvedValue(null);
    pushMock.mockReset();
    pushMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    writePhaseMemoryMock.mockReset();
    writePhaseMemoryMock.mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  async function setup(): Promise<void> {
    await writeFile(join(cwd, 'package.json'), '{\n  "version": "1.2.3"\n}\n', 'utf-8');
    await writeFile(join(cwd, 'CHANGELOG.md'), CHANGELOG, 'utf-8');
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'Phase to release',
            status: 'doing',
            steps: [{ title: 'step 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(
      cwd,
      1,
      `---
phase: 1
verdict: done
steps:
  - title: "step 1"
    status: done
---
`,
    );
  }

  it('--push --bump minor folds Unreleased into a dated section', async () => {
    await setup();

    const r = await applyDone(cwd, { push: true, bump: 'minor' });

    expect(r.ok).toBe(true);
    const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf-8');
    // minor from 1.2.3 → 1.3.0, today's date
    expect(changelog).toMatch(/## \[1\.3\.0\] - \d{4}-\d{2}-\d{2}\n### Added\n- new feature/);
    // a fresh empty Unreleased stays on top
    expect(changelog).toMatch(/## \[Unreleased\]\n\n## \[1\.3\.0\]/);
  });

  it('patch (even with --push) does not stamp Unreleased — entries stay', async () => {
    await setup();

    const r = await applyDone(cwd, { push: true, bump: 'patch' });

    expect(r.ok).toBe(true);
    const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf-8');
    expect(changelog).toMatch(/## \[Unreleased\]\n### Added\n- new feature/);
    expect(changelog).not.toMatch(/## \[1\.2\.4\]/);
  });

  it('minor without --push (local commit only) does not stamp Unreleased', async () => {
    await setup();

    const r = await applyDone(cwd, { bump: 'minor' });

    expect(r.ok).toBe(true);
    const changelog = await readFile(join(cwd, 'CHANGELOG.md'), 'utf-8');
    expect(changelog).toMatch(/## \[Unreleased\]\n### Added\n- new feature/);
    expect(changelog).not.toMatch(/## \[1\.3\.0\]/);
  });

  it('a missing CHANGELOG.md does not crash done (best-effort)', async () => {
    await setup();
    await rm(join(cwd, 'CHANGELOG.md'));

    const r = await applyDone(cwd, { push: true, bump: 'major' });

    expect(r.ok).toBe(true);
    expect(commitAllMock).toHaveBeenCalledTimes(1);
  });
});
