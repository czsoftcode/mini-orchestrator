import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyNewPhase } from './next.js';
import { applyPlanSteps, parseStepsFromStdin } from './plan.js';
import { applyDoStart } from './do.js';
import { applyDone } from './done.js';
import { load, save } from '../state/store.js';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import type { Phase, ProjectState } from '../state/types.js';
import { writePhaseMemory } from './writeMemory.js';

// Git: chováme se jako „nejsme v repu", takže close path commit nedělá.
vi.mock('../git.js', () => ({
  isGitRepo: vi.fn(async () => false),
  hasChanges: vi.fn(async () => false),
  commitAll: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  headSha: vi.fn(async () => null),
}));

// Memory zápis spouští skutečnou Claude session — v testech no-op.
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
  it('bere každý neprázdný řádek jako krok (bez oddělovače → jen title)', () => {
    expect(parseStepsFromStdin('první\ndruhý\ntřetí')).toEqual([
      { title: 'první' },
      { title: 'druhý' },
      { title: 'třetí' },
    ]);
  });

  it('ignoruje prázdné řádky a ořeže mezery', () => {
    expect(parseStepsFromStdin('  a  \n\n\t b \n')).toEqual([{ title: 'a' }, { title: 'b' }]);
  });

  it('odstraní běžné prefixy seznamu (STEP:, -, *, 1.)', () => {
    const text = 'STEP: jedna\n- dva\n* tři\n1. čtyři\n2) pět';
    expect(parseStepsFromStdin(text)).toEqual([
      { title: 'jedna' },
      { title: 'dva' },
      { title: 'tři' },
      { title: 'čtyři' },
      { title: 'pět' },
    ]);
  });

  it('rozdělí title a detail na oddělovači ` :: `', () => {
    expect(parseStepsFromStdin('Krátký title :: delší kritérium k ověření')).toEqual([
      { title: 'Krátký title', detail: 'delší kritérium k ověření' },
    ]);
  });

  it('bere první výskyt oddělovače a snese dvojtečky v textu', () => {
    expect(parseStepsFromStdin('Upravit foo:bar :: detail: viz soubor a:b')).toEqual([
      { title: 'Upravit foo:bar', detail: 'detail: viz soubor a:b' },
    ]);
  });

  it('prázdný detail za oddělovačem se vynechá (zůstane jen title)', () => {
    expect(parseStepsFromStdin('jen title ::   ')).toEqual([{ title: 'jen title' }]);
  });

  it('prefix funguje i s oddělovačem na stejném řádku', () => {
    expect(parseStepsFromStdin('STEP: title :: detail')).toEqual([
      { title: 'title', detail: 'detail' },
    ]);
  });

  it('prázdný vstup → prázdný seznam', () => {
    expect(parseStepsFromStdin('   \n\n')).toEqual([]);
  });
});

describe('applyNewPhase', () => {
  it('bez projektu vrátí no-project', async () => {
    const r = await applyNewPhase('A', 'cíl', cwd);
    expect(r).toEqual({ ok: false, reason: 'no-project' });
  });

  it('uloží novou fázi a nastaví ji jako aktuální, když je první', async () => {
    await save(makeState([], null), cwd);
    const r = await applyNewPhase('První fáze', 'kdy je hotová', cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases).toHaveLength(1);
    expect(state.phases[0]).toMatchObject({ id: 1, title: 'První fáze', goal: 'kdy je hotová', status: 'proposed' });
    expect(state.currentPhaseId).toBe(1);
  });

  it('další fáze dostane id o 1 vyšší a aktuální se nemění', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing' }], 1), cwd);
    const r = await applyNewPhase('B', 'cíl B', cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases.map((p) => p.id)).toEqual([1, 2]);
    expect(state.currentPhaseId).toBe(1);
  });
});

describe('applyPlanSteps', () => {
  it('uloží kroky a posune proposed → planned', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'proposed' }], 1), cwd);
    const r = await applyPlanSteps([{ title: 'krok 1' }, { title: 'krok 2' }], cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('planned');
    expect(state.phases[0]!.steps).toEqual([
      { title: 'krok 1', status: 'todo' },
      { title: 'krok 2', status: 'todo' },
    ]);
  });

  it('uloží detail jen u kroků, které ho mají (prázdný se vynechá)', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'proposed' }], 1), cwd);
    const r = await applyPlanSteps(
      [
        { title: 'krok 1', detail: 'kritérium 1' },
        { title: 'krok 2' },
        { title: 'krok 3', detail: '   ' },
      ],
      cwd,
    );
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.steps).toEqual([
      { title: 'krok 1', status: 'todo', detail: 'kritérium 1' },
      { title: 'krok 2', status: 'todo' },
      { title: 'krok 3', status: 'todo' },
    ]);
  });

  it('prázdný seznam kroků → no-steps', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'proposed' }], 1), cwd);
    const r = await applyPlanSteps([{ title: '   ' }, { title: '' }], cwd);
    expect(r).toEqual({ ok: false, reason: 'no-steps' });
  });

  it('bez aktuální fáze → no-current-phase', async () => {
    await save(makeState([], null), cwd);
    const r = await applyPlanSteps([{ title: 'krok' }], cwd);
    expect(r).toEqual({ ok: false, reason: 'no-current-phase' });
  });
});

describe('applyDoStart', () => {
  it('označí fázi jako doing, nastaví startedAt a založí .mini/run/', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1), cwd);
    const r = await applyDoStart(cwd);
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('doing');
    expect(state.phases[0]!.startedAt).toBeDefined();
    expect(await exists(join(cwd, '.mini', 'run'))).toBe(true);
  });

  it('hotovou fázi nepřepíše', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'done' }], 1), cwd);
    const r = await applyDoStart(cwd);
    expect(r).toEqual({ ok: false, reason: 'phase-done' });
  });
});

describe('applyDone', () => {
  it('chybějící report → no-report (nepadá do interaktivního fallbacku)', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing', steps: [{ title: 's', status: 'doing' }] }], 1), cwd);
    const r = await applyDone(cwd);
    expect(r).toEqual({ ok: false, reason: 'no-report' });
  });

  it('report bez verify uzavře fázi a posune se dál', async () => {
    await save(
      makeState(
        [
          { id: 1, title: 'A', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }] },
          { id: 2, title: 'B', status: 'proposed' },
        ],
        1,
      ),
      cwd,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      ['---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "krok 1"', '    status: done', '---', '', 'hotovo'].join('\n'),
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

  it('verify body bez --accept-verify (neinteraktivně) fázi nezavře', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }] }], 1), cwd);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "krok 1"', '    status: done',
        'verify:', '  - title: "zkontroluj UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );

    const r = await applyDone(cwd);
    expect(r).toEqual({ ok: false, reason: 'verify-needs-human' });
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('doing');
  });

  it('verify body s --accept-verify fázi zavře a zapamatuje je jako vyřešené', async () => {
    await save(makeState([{ id: 1, title: 'A', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }] }], 1), cwd);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "krok 1"', '    status: done',
        'verify:', '  - title: "zkontroluj UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );

    const r = await applyDone(cwd, { acceptVerify: true });
    expect(r.ok).toBe(true);
    const state = await load(cwd);
    expect(state.phases[0]!.status).toBe('done');
    expect(state.phases[0]!.resolvedVerify).toContain('zkontroluj UI');
  });

  it('zbývající kroky v reportu fázi nezavřou', async () => {
    await save(
      makeState(
        [{ id: 1, title: 'A', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }, { title: 'krok 2', status: 'todo' }] }],
        1,
      ),
      cwd,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: partial', 'steps:',
        '  - title: "krok 1"', '    status: done',
        '  - title: "krok 2"', '    status: todo',
        '---', '', 'nedotaženo',
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
