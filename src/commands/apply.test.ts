import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyNewPhase } from './next.js';
import { applyPlanSteps, parseStepsFromStdin } from './plan.js';
import { applyDoStart } from './do.js';
import { applyDone } from './done.js';
import { load, save } from '../state/store.js';
import { readTodos, writeTodos } from '../state/todoStore.js';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import type { Phase, ProjectState } from '../state/types.js';
import { writePhaseMemory } from './writeMemory.js';

// Git: we behave like "we are not in a repo", so the close path makes no commit.
vi.mock('../git.js', () => ({
  isGitRepo: vi.fn(async () => false),
  hasChanges: vi.fn(async () => false),
  commitAll: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  headSha: vi.fn(async () => null),
}));

// The memory write runs a real Claude session — no-op in tests.
vi.mock('./writeMemory.js', () => ({
  writePhaseMemory: vi.fn(async () => {}),
}));

const writePhaseMemoryMock = vi.mocked(writePhaseMemory);

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-apply-'));
  writePhaseMemoryMock.mockClear();
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

function makeState(phases: Phase[], currentPhaseId: number | null): ProjectState {
  return { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId, phases };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('parseStepsFromStdin', () => {
  it('takes every non-empty line as a step (no separator → just title)', () => {
    expect(parseStepsFromStdin('first\nsecond\nthird')).toEqual([
      { title: 'first' },
      { title: 'second' },
      { title: 'third' },
    ]);
  });

  it('ignores empty lines and trims spaces', () => {
    expect(parseStepsFromStdin('  a  \n\n\t b \n')).toEqual([{ title: 'a' }, { title: 'b' }]);
  });

  it('strips common list prefixes (STEP:, -, *, 1.)', () => {
    const text = 'STEP: one\n- two\n* three\n1. four\n2) five';
    expect(parseStepsFromStdin(text)).toEqual([
      { title: 'one' },
      { title: 'two' },
      { title: 'three' },
      { title: 'four' },
      { title: 'five' },
    ]);
  });

  it('splits title and detail on the ` :: ` separator', () => {
    expect(parseStepsFromStdin('Short title :: longer criterion to verify')).toEqual([
      { title: 'Short title', detail: 'longer criterion to verify' },
    ]);
  });

  it('takes the first occurrence of the separator and tolerates colons in the text', () => {
    expect(parseStepsFromStdin('Edit foo:bar :: detail: see file a:b')).toEqual([
      { title: 'Edit foo:bar', detail: 'detail: see file a:b' },
    ]);
  });

  it('an empty detail after the separator is omitted (only the title stays)', () => {
    expect(parseStepsFromStdin('just title ::   ')).toEqual([{ title: 'just title' }]);
  });

  it('the prefix works with a separator on the same line too', () => {
    expect(parseStepsFromStdin('STEP: title :: detail')).toEqual([
      { title: 'title', detail: 'detail' },
    ]);
  });

  it('empty input → empty list', () => {
    expect(parseStepsFromStdin('   \n\n')).toEqual([]);
  });
});

describe('applyNewPhase', () => {
  it('without a project returns no-project', async () => {
    const r = await applyNewPhase('A', 'goal', { cwd });
    expect(r).toEqual({ ok: false, reason: 'no-project' });
  });

  it('saves a new phase and sets it as current when it is the first', async () => {
    await save(makeState([], null), cwd);
    const r = await applyNewPhase('First phase', 'when it is done', { cwd });
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases).toHaveLength(1);
    expect(state.phases[0]).toMatchObject({ id: 1, title: 'First phase', goal: 'when it is done', status: 'proposed' });
    expect(state.currentPhaseId).toBe(1);
  });

  it('the next phase gets an id 1 higher and the current one does not change', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing' }], 1), cwd);
    const r = await applyNewPhase('B', 'goal B', { cwd });
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases.map((p) => p.id)).toEqual([1, 2]);
    expect(state.currentPhaseId).toBe(1);
  });

  it('--from-todo ticks off the source backlog item after saving', async () => {
    await save(makeState([], null), cwd);
    await writeTodos(
      [
        { text: 'first idea', done: false },
        { text: 'second idea', done: false },
      ],
      cwd,
    );

    const r = await applyNewPhase('From backlog', 'goal', { cwd, fromTodo: 2 });

    expect(r.ok).toBe(true);
    expect(await readTodos(cwd)).toEqual([
      { text: 'first idea', done: false },
      { text: 'second idea', done: true },
    ]);
  });

  it('an out-of-range --from-todo does not fail the save', async () => {
    await save(makeState([], null), cwd);
    await writeTodos([{ text: 'only idea', done: false }], cwd);

    const r = await applyNewPhase('From backlog', 'goal', { cwd, fromTodo: 9 });

    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases).toHaveLength(1);
    expect(await readTodos(cwd)).toEqual([{ text: 'only idea', done: false }]);
  });
});

describe('applyPlanSteps', () => {
  it('saves the steps and advances proposed → planned', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'proposed' }], 1), cwd);
    const r = await applyPlanSteps([{ title: 'step 1' }, { title: 'step 2' }], cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('planned');
    expect(state.phases[0]!.steps).toEqual([
      { title: 'step 1', status: 'todo' },
      { title: 'step 2', status: 'todo' },
    ]);
  });

  it('saves detail only for steps that have it (empty is omitted)', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'proposed' }], 1), cwd);
    const r = await applyPlanSteps(
      [
        { title: 'step 1', detail: 'criterion 1' },
        { title: 'step 2' },
        { title: 'step 3', detail: '   ' },
      ],
      cwd,
    );
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.steps).toEqual([
      { title: 'step 1', status: 'todo', detail: 'criterion 1' },
      { title: 'step 2', status: 'todo' },
      { title: 'step 3', status: 'todo' },
    ]);
  });

  it('empty step list → no-steps', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'proposed' }], 1), cwd);
    const r = await applyPlanSteps([{ title: '   ' }, { title: '' }], cwd);
    expect(r).toEqual({ ok: false, reason: 'no-steps' });
  });

  it('without a current phase → no-current-phase', async () => {
    await save(makeState([], null), cwd);
    const r = await applyPlanSteps([{ title: 'step' }], cwd);
    expect(r).toEqual({ ok: false, reason: 'no-current-phase' });
  });
});

describe('applyDoStart', () => {
  it('marks the phase as doing, sets startedAt, and creates .mini/run/', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1), cwd);
    const r = await applyDoStart(cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('doing');
    expect(state.phases[0]!.startedAt).toBeDefined();
    expect(await exists(join(cwd, '.mini', 'run'))).toBe(true);
  });

  it('does not overwrite a finished phase', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'done' }], 1), cwd);
    const r = await applyDoStart(cwd);
    expect(r).toEqual({ ok: false, reason: 'phase-done' });
  });
});

describe('applyDone', () => {
  it('missing report → no-report (does not drop into the interactive fallback)', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing', steps: [{ title: 's', status: 'doing' }] }], 1), cwd);
    const r = await applyDone(cwd);
    expect(r).toEqual({ ok: false, reason: 'no-report' });
  });

  it('a report without verify closes the phase and moves on', async () => {
    await save(
      makeState(
        [
          { id: 1, title: 'A', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }] },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      ['---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "step 1"', '    status: done', '---', '', 'done'].join('\n'),
      'utf-8',
    );

    const r = await applyDone(cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('done');
    expect(state.phases[0]!.steps![0]!.status).toBe('done');
    expect(state.currentPhaseId).toBe(2);
    expect(writePhaseMemoryMock).toHaveBeenCalledOnce();
  });

  it('verify items without --accept-verify (non-interactive) do not close the phase', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }] }], 1), cwd);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "step 1"', '    status: done',
        'verify:', '  - title: "check the UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );

    const r = await applyDone(cwd);
    expect(r).toEqual({ ok: false, reason: 'verify-needs-human' });
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('doing');
  });

  it('verify items with --accept-verify close the phase and remember them as resolved', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }] }], 1), cwd);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "step 1"', '    status: done',
        'verify:', '  - title: "check the UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );

    const r = await applyDone(cwd, { acceptVerify: true });
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('done');
    expect(state.phases[0]!.resolvedVerify).toContain('check the UI');
  });

  it('remaining steps in the report do not close the phase', async () => {
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'doing', steps: [{ title: 'step 1', status: 'doing' }, { title: 'step 2', status: 'todo' }] }],
        1,
      ),
      cwd,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: partial', 'steps:',
        '  - title: "step 1"', '    status: done',
        '  - title: "step 2"', '    status: todo',
        '---', '', 'not finished',
      ].join('\n'),
      'utf-8',
    );

    const r = await applyDone(cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('doing');
    expect(state.phases[0]!.steps![0]!.status).toBe('done');
    expect(state.phases[0]!.steps![1]!.status).toBe('todo');
  });
});
