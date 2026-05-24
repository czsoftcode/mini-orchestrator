import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { advanceToNextPhase, buildPhaseCommitMessage, done } from './done.js';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import { load, save } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { commitAll, hasChanges, headSha, isGitRepo } from '../git.js';
import { writePhaseMemory } from './writeMemory.js';

// `ask` nahrazujeme `vi.fn`, ať můžeme v testech přepínat implementaci —
// většinou má vyhodit (auto mód se ho nesmí dotknout), ale fallback testy
// si přepnou vlastní odpověď.
vi.mock('../ui/ask.js', () => ({
  ask: vi.fn(async () => {
    throw new Error('ask() nesmí být v auto módu zavoláno');
  }),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

// Git modul mockujeme — defaultně se chová jako „nejsme v gitovém repu",
// takže existující testy (běžící v `tmpdir`) commit logiku neaktivují.
// Konkrétní testy si gitové funkce přepnou přes `mockResolvedValueOnce`.
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

// Memory zápis mockujeme — testy nesmí spouštět skutečnou Claude session.
// Defaultně no-op; konkrétní testy si ho spy-ují přes `writePhaseMemoryMock`.
vi.mock('./writeMemory.js', () => ({
  writePhaseMemory: vi.fn(async () => {}),
}));

const askMock = vi.mocked(ask);
const isGitRepoMock = vi.mocked(isGitRepo);
const hasChangesMock = vi.mocked(hasChanges);
const commitAllMock = vi.mocked(commitAll);
const headShaMock = vi.mocked(headSha);
const writePhaseMemoryMock = vi.mocked(writePhaseMemory);

async function writeRunReport(cwd: string, phaseId: number, body: string): Promise<void> {
  await ensureRunDir(cwd);
  await writeFile(runReportPath(cwd, phaseId), body, 'utf-8');
}

function makeState(phases: Phase[], currentPhaseId: number | null): ProjectState {
  return {
    version: 1,
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
      throw new Error('ask() nesmí být v auto módu zavoláno');
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

  it('aplikuje statusy z reportu a nechá fázi doing, když report má todo krok', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'doing' },
              { title: 'krok 2', status: 'todo' },
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
  - title: "krok 1"
    status: done
  - title: "krok 2"
    status: todo
---

Krok 2 nestihl jsem.
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

  it('finalizuje fázi a posune se dál, když report označí všechny kroky jako done', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'done' },
              { title: 'krok 2', status: 'doing' },
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
  - title: "krok 1"
    status: done
  - title: "krok 2"
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

  it('akceptuje skipped kroky v reportu a finalizuje fázi, když nezbude nic neuzavřeného', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'done' },
              { title: 'krok 2', status: 'todo' },
              { title: 'krok 3', status: 'todo' },
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
  - title: "krok 1"
    status: done
  - title: "krok 2"
    status: skipped
  - title: "krok 3"
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

  it('blocked status v reportu drží krok jako todo a fázi nezavírá', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'done' },
              { title: 'krok 2', status: 'doing' },
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
  - title: "krok 1"
    status: done
  - title: "krok 2"
    status: blocked
---

Krok 2 vyžaduje API klíč, který nemám.
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

  it('finalizuje fázi bez kroků, když report má verdict=done', async () => {
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

  it('fázi bez kroků nezavírá, když report má verdict=partial', async () => {
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

Nestihl jsem.
`,
    );

    const r = await done({ auto: true });

    expect(r).toEqual({ ok: true });
    const loaded = await load(cwd);
    expect(loaded.phases[0]?.status).toBe('doing');
    expect(loaded.currentPhaseId).toBe(1);
  });

  it('vynuluje currentPhaseId, když po finalizaci není další fáze', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
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
  - title: "krok 1"
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

  it('perzistuje stav na disk, aby ho další load viděl', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
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
  - title: "krok 1"
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

describe('done({ auto: true }) — fallback do interaktivního módu', () => {
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

  it('chybějící report → interaktivní fallback (uživatel rozhoduje per krok)', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'doing' },
              { title: 'krok 2', status: 'todo' },
            ],
          },
        ],
        1,
      ),
      cwd,
    );

    // Interaktivní done() s doing krokem a zbylými todo: zeptá se jen na
    // outcome doingu (1 ask) a vrátí se s hintem na `mini do`.
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

  it('poškozený report → interaktivní fallback, nic neoznačuje naslepo', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'A',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    await writeRunReport(cwd, 1, 'tohle není validní report\n');

    // outcome u "doing" kroku → "done", protože byl poslední, finalizace fáze (notes prázdné).
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
  it('subject obsahuje id i title', () => {
    const msg = buildPhaseCommitMessage({ id: 7, title: 'Něco hotového', status: 'done' });
    expect(msg).toBe('Fáze 7: Něco hotového');
  });

  it('přidá tělo s humanNotes, pokud existuje', () => {
    const msg = buildPhaseCommitMessage({
      id: 3,
      title: 'S poznámkami',
      status: 'done',
      humanNotes: 'Funguje, ale plán by se měl ještě zjednodušit.',
    });
    expect(msg).toBe(
      'Fáze 3: S poznámkami\n\nFunguje, ale plán by se měl ještě zjednodušit.\n',
    );
  });

  it('ignoruje prázdné / whitespace humanNotes', () => {
    const msg = buildPhaseCommitMessage({
      id: 1,
      title: 'Bez poznámek',
      status: 'done',
      humanNotes: '   \n  ',
    });
    expect(msg).toBe('Fáze 1: Bez poznámek');
  });
});

describe('commit po finalizaci fáze', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-commit-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockImplementation(async () => {
      throw new Error('ask() nesmí být v auto módu zavoláno');
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
            title: 'Fáze ke commitu',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
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
  - title: "krok 1"
    status: done
---
`,
    );
  }

  it('commitne fázi, když je `done`, je git repo a jsou změny', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).toHaveBeenCalledTimes(1);
    const [calledCwd, msg] = commitAllMock.mock.calls[0]!;
    expect(calledCwd).toBe(cwd);
    expect(msg).toBe('Fáze 1: Fáze ke commitu');
  });

  it('uloží `phase.autoCommit` (preSha, sha, subject) po úspěšném commitu', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({ ok: true, stdout: '', stderr: '' });
    // headSha se volá 2× — před commitem (pre) a po commitu (post).
    headShaMock
      .mockResolvedValueOnce('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      .mockResolvedValueOnce('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    const reloaded = await load(cwd);
    const phase = reloaded.phases[0];
    expect(phase?.autoCommit).toEqual({
      preSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      subject: 'Fáze 1: Fáze ke commitu',
    });
  });

  it('selhání commitu nezapíše `phase.autoCommit`', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({ ok: false, stdout: '', stderr: 'fail' });
    headShaMock.mockResolvedValue('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    await done({ auto: true });

    const reloaded = await load(cwd);
    expect(reloaded.phases[0]?.autoCommit).toBeUndefined();
  });

  it('commit přeskočí, když cwd není git repo', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(false);

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).not.toHaveBeenCalled();
  });

  it('commit přeskočí, když nejsou žádné změny', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(false);

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).not.toHaveBeenCalled();
  });

  it('selhání commitu (`ok: false`) neshodí done — stav je už uložený', async () => {
    await setupDoneAutoPhase();
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    commitAllMock.mockResolvedValue({
      ok: false,
      stdout: '',
      stderr: 'fatal: chyba commitu',
    });

    const r = await done({ auto: true });

    expect(r.ok).toBe(true);
    expect(commitAllMock).toHaveBeenCalledTimes(1);
    // stav fáze je i tak posunutý — uživatel si commit dotáhne ručně
    const reloaded = await load(cwd);
    expect(reloaded.phases[0]?.status).toBe('done');
  });

  it('skipped fáze se necommituje', async () => {
    // Setup: jediný krok je `doing`, ale interaktivní done volíme `skip`.
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'Odkládaná fáze',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    isGitRepoMock.mockResolvedValue(true);
    hasChangesMock.mockResolvedValue(true);
    // 1. ask: krok → "skip", 2. ask: fáze → "skip", 3. ask: notes → ''
    // (skip kroku finalizuje krok, pak run dorazí k finalizePhase, kde
    //  outcome=skip a notes nejsou potřeba, ale done si je vyžádá tak jako tak)
    askMock
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ notes: '' });

    await done();

    expect(commitAllMock).not.toHaveBeenCalled();
  });

  it('interaktivní force-done volí commit s humanNotes v těle', async () => {
    await save(
      makeState(
        [
          {
            id: 2,
            title: 'Fáze s poznámkou',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'done' },
              { title: 'krok 2', status: 'todo' },
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
      // done() vidí remainingSteps > 0 → vyzve k "decision"; volíme force-done
      .mockResolvedValueOnce({ decision: 'force-done' })
      // collectNotesAndSave si pak vyžádá poznámku
      .mockResolvedValueOnce({ notes: 'Tohle si nech.' });

    await done();

    expect(commitAllMock).toHaveBeenCalledTimes(1);
    const [, msg] = commitAllMock.mock.calls[0]!;
    expect(msg).toBe('Fáze 2: Fáze s poznámkou\n\nTohle si nech.\n');
  });
});

describe('memory zápis po finalizaci fáze', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-done-memory-'));
    process.chdir(cwd);
    askMock.mockReset();
    askMock.mockImplementation(async () => {
      throw new Error('ask() nesmí být v auto módu zavoláno');
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
            title: 'Fáze do paměti',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
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
  - title: "krok 1"
    status: done
---
`,
    );
  }

  it('zavolá writePhaseMemory po finalizaci fáze v auto módu', async () => {
    await setupDonePhaseViaAuto();

    await done({ auto: true });

    expect(writePhaseMemoryMock).toHaveBeenCalledTimes(1);
    const [calledPhase, , calledCwd, calledOpts] = writePhaseMemoryMock.mock.calls[0]!;
    expect(calledPhase.id).toBe(1);
    expect(calledPhase.status).toBe('done');
    expect(calledCwd).toBe(cwd);
    expect(calledOpts).toEqual({ hasAutoCommit: false });
  });

  it('předá hasAutoCommit=true, když auto-commit proběhl', async () => {
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

  it('nezavolá writePhaseMemory u skipped fáze', async () => {
    await save(
      makeState(
        [
          {
            id: 1,
            title: 'Odložená fáze',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
          },
        ],
        1,
      ),
      cwd,
    );
    // Interaktivní cesta: krok → skip, fáze → skip, notes → ''
    askMock
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ outcome: 'skip' })
      .mockResolvedValueOnce({ notes: '' });

    await done();

    expect(writePhaseMemoryMock).not.toHaveBeenCalled();
  });

  it('zavolá writePhaseMemory i u interaktivní force-done cesty', async () => {
    await save(
      makeState(
        [
          {
            id: 4,
            title: 'Force-done fáze',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'done' },
              { title: 'krok 2', status: 'todo' },
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

  it('zavolá writePhaseMemory v interaktivní finalizePhase ("Hotová, funguje")', async () => {
    await save(
      makeState(
        [
          {
            id: 5,
            title: 'Interaktivní done fáze',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'done' }],
          },
        ],
        5,
      ),
      cwd,
    );
    // Žádné neuzavřené kroky → rovnou finalizePhase: outcome → done, notes → ''
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
      throw new Error('ask() nesmí být v auto módu zavoláno');
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

  it('regeneruje .mini/graph.md po finalizaci fáze v TS projektu', async () => {
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

    const graph = await readFile(join(cwd, '.mini', 'graph.md'), 'utf-8');
    expect(graph).toContain('## a.ts');
    expect(graph).toContain('const a');
  });

  it('přeskočí regeneraci v non-TS projektu', async () => {
    await writeFile(join(cwd, 'package.json'), '{}', 'utf-8');
    await writeFile(join(cwd, 'main.js'), 'module.exports = {};', 'utf-8');
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

    await expect(access(join(cwd, '.mini', 'graph.md'))).rejects.toThrow();
  });
});
