import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exists,
  hasPrev,
  load,
  loadFullState,
  loadHeader,
  loadPhase,
  loadPrev,
  newState,
  phaseFileName,
  phaseStem,
  phasesDir,
  restorePrev,
  save,
  saveHeader,
  savePhase,
  statePath,
  statePrevPath,
} from './store.js';
import type { Phase, ProjectState, StateHeader } from './types.js';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-store-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('phaseStem', () => {
  it('padduje na 3 číslice', () => {
    expect(phaseStem(1)).toBe('phase-001');
    expect(phaseStem(60)).toBe('phase-060');
    expect(phaseStem(999)).toBe('phase-999');
  });

  it('neořezává — fáze >= 1000 má přirozeně delší stem', () => {
    expect(phaseStem(1000)).toBe('phase-1000');
    expect(phaseStem(12345)).toBe('phase-12345');
  });

  it('phaseFileName je stem + .json', () => {
    expect(phaseFileName(60)).toBe('phase-060.json');
    expect(phaseFileName(1000)).toBe('phase-1000.json');
  });
});

describe('save / load', () => {
  it('saves a state and loads it back identical', async () => {
    const state = newState();
    state.phases.push({ id: 1, title: 'P1', status: 'planned' });
    state.currentPhaseId = 1;

    await save(state, cwd);
    const loaded = await load(cwd);

    expect(loaded).toEqual(state);
    expect(await exists(cwd)).toBe(true);
  });

  it('creates the .mini directory if it does not exist', async () => {
    const state = newState();

    await save(state, cwd);

    const entries = await readdir(join(cwd, '.mini'));
    expect(entries).toContain('state.json');
  });

  it('writes state.json atomically via a temp file (no .tmp left behind)', async () => {
    const state = newState();
    await save(state, cwd);

    const entries = await readdir(join(cwd, '.mini'));
    expect(entries).not.toContain('state.json.tmp');
    expect(entries).toContain('state.json');
  });
});

describe('restorePrev', () => {
  it('does not create state.prev.json on the first save', async () => {
    await save(newState(), cwd);
    expect(await hasPrev(cwd)).toBe(false);
  });

  it('backs up the old state into state.prev.json on subsequent saves', async () => {
    const first: ProjectState = { ...newState(), currentPhaseId: 1 };
    const second: ProjectState = { ...newState(), currentPhaseId: 2 };

    await save(first, cwd);
    await save(second, cwd);

    expect(await hasPrev(cwd)).toBe(true);
    const prev = await loadPrev(cwd);
    expect(prev.currentPhaseId).toBe(1);
    const current = await load(cwd);
    expect(current.currentPhaseId).toBe(2);
  });

  it('restorePrev moves the previous state back to state.json', async () => {
    const first: ProjectState = { ...newState(), currentPhaseId: 1 };
    const second: ProjectState = { ...newState(), currentPhaseId: 2 };

    await save(first, cwd);
    await save(second, cwd);
    await restorePrev(cwd);

    const restored = await load(cwd);
    expect(restored.currentPhaseId).toBe(1);
    expect(await hasPrev(cwd)).toBe(false);
  });
});

describe('atomic write under failure', () => {
  it('leaves the original state.json intact if a concurrent reader reads mid-save', async () => {
    const original: ProjectState = { ...newState(), currentPhaseId: 42 };
    await save(original, cwd);

    // Simulate stale .tmp file from a previously aborted write — save must
    // still produce a valid state.json (rename overwrites the target).
    await writeFile(`${statePath(cwd)}.tmp`, 'GARBAGE', 'utf-8');

    const next: ProjectState = { ...newState(), currentPhaseId: 99 };
    await save(next, cwd);

    const raw = await readFile(statePath(cwd), 'utf-8');
    const parsed = JSON.parse(raw) as ProjectState;
    expect(parsed.currentPhaseId).toBe(99);

    // and the previous version is preserved
    const prevRaw = await readFile(statePrevPath(cwd), 'utf-8');
    const prevParsed = JSON.parse(prevRaw) as ProjectState;
    expect(prevParsed.currentPhaseId).toBe(42);
  });
});

describe('layout verze 2 (fáze po souborech)', () => {
  const detailedPhase: Phase = {
    id: 1,
    title: 'P1',
    status: 'doing',
    goal: 'něco udělat',
    steps: [{ title: 'krok A', status: 'done' }],
    humanNotes: 'pozn',
  };

  it('hlavička drží jen lehký index, detail je v .mini/phases/', async () => {
    const state: ProjectState = { ...newState(), currentPhaseId: 1, phases: [detailedPhase] };
    await save(state, cwd);

    const header = JSON.parse(await readFile(statePath(cwd), 'utf-8')) as StateHeader;
    expect(header.version).toBe(2);
    expect(header.phases).toEqual([{ id: 1, title: 'P1', status: 'doing' }]);
    // detail (goal/steps) v hlavičce NENÍ
    expect((header.phases[0] as Record<string, unknown>).goal).toBeUndefined();
    expect((header.phases[0] as Record<string, unknown>).steps).toBeUndefined();

    const phaseFiles = await readdir(phasesDir(cwd));
    expect(phaseFiles).toContain(phaseFileName(1));
    const detail = JSON.parse(
      await readFile(join(phasesDir(cwd), phaseFileName(1)), 'utf-8'),
    ) as Phase;
    expect(detail.goal).toBe('něco udělat');
    expect(detail.steps).toEqual([{ title: 'krok A', status: 'done' }]);
  });

  it('loadFullState sesype hlavičku + soubory zpět do identického stavu', async () => {
    const state: ProjectState = { ...newState(), currentPhaseId: 1, phases: [detailedPhase] };
    await save(state, cwd);

    expect(await loadFullState(cwd)).toEqual(state);
  });

  it('granulární loadHeader / loadPhase', async () => {
    const state: ProjectState = { ...newState(), currentPhaseId: 1, phases: [detailedPhase] };
    await save(state, cwd);

    const header = await loadHeader(cwd);
    expect(header.phases).toEqual([{ id: 1, title: 'P1', status: 'doing' }]);
    expect(await loadPhase(cwd, 1)).toEqual(detailedPhase);
    expect(await loadPhase(cwd, 99)).toBeNull();
  });

  it('saveHeader / savePhase zapisují odděleně', async () => {
    await saveHeader(
      { version: 2, createdAt: 'x', currentPhaseId: 2, phases: [{ id: 2, title: 'P2', status: 'planned' }] },
      cwd,
    );
    await savePhase({ id: 2, title: 'P2', status: 'planned', goal: 'cíl' }, cwd);

    expect((await loadHeader(cwd)).currentPhaseId).toBe(2);
    expect((await loadPhase(cwd, 2))?.goal).toBe('cíl');
  });

  it('starý monolitický state.json (version 1) skončí chybou s hintem na migrate', async () => {
    const legacy = {
      version: 1,
      createdAt: 'x',
      currentPhaseId: 1,
      phases: [{ id: 1, title: 'P1', status: 'done' }],
    };
    await mkdir(join(cwd, '.mini'), { recursive: true });
    await writeFile(statePath(cwd), JSON.stringify(legacy), 'utf-8');

    await expect(load(cwd)).rejects.toThrow(/mini migrate/);
  });
});

describe('snapshot adresáře fází pro undo', () => {
  it('loadPrev/restorePrev vrací i detail fází z prev-vrstvy', async () => {
    const first: ProjectState = {
      ...newState(),
      currentPhaseId: 1,
      phases: [{ id: 1, title: 'P1', status: 'doing', steps: [{ title: 'a', status: 'todo' }] }],
    };
    const second: ProjectState = {
      ...newState(),
      currentPhaseId: 1,
      phases: [{ id: 1, title: 'P1', status: 'done', steps: [{ title: 'a', status: 'done' }] }],
    };

    await save(first, cwd);
    await save(second, cwd);

    const prev = await loadPrev(cwd);
    expect(prev.phases[0]?.status).toBe('doing');
    expect(prev.phases[0]?.steps?.[0]?.status).toBe('todo');

    await restorePrev(cwd);
    const restored = await load(cwd);
    expect(restored.phases[0]?.status).toBe('doing');
    expect(restored.phases[0]?.steps?.[0]?.status).toBe('todo');
    expect(await hasPrev(cwd)).toBe(false);
  });

  it('prune: úbytek fází při uložení smaže osiřelé soubory', async () => {
    const two: ProjectState = {
      ...newState(),
      phases: [
        { id: 1, title: 'P1', status: 'done' },
        { id: 2, title: 'P2', status: 'doing' },
      ],
    };
    await save(two, cwd);
    expect(await readdir(phasesDir(cwd))).toContain(phaseFileName(2));

    const one: ProjectState = { ...newState(), phases: [{ id: 1, title: 'P1', status: 'done' }] };
    await save(one, cwd);
    expect(await readdir(phasesDir(cwd))).not.toContain(phaseFileName(2));
  });
});

describe('zápis jen změněných fází', () => {
  const mtimeOf = async (cwd: string, id: number): Promise<number> =>
    (await stat(join(phasesDir(cwd), phaseFileName(id)))).mtimeMs;

  it('opakovaný save se stejným stavem nezapíše soubor nezměněné fáze', async () => {
    const state: ProjectState = {
      ...newState(),
      currentPhaseId: 1,
      phases: [
        { id: 1, title: 'P1', status: 'doing' },
        { id: 2, title: 'P2', status: 'planned' },
      ],
    };
    await save(state, cwd);
    const before1 = await mtimeOf(cwd, 1);
    const before2 = await mtimeOf(cwd, 2);

    // druhý identický save: žádný soubor fáze se nesmí znovu zapsat
    await save(state, cwd);
    expect(await mtimeOf(cwd, 1)).toBe(before1);
    expect(await mtimeOf(cwd, 2)).toBe(before2);
  });

  it('save přepíše jen tu fázi, jejíž obsah se změnil', async () => {
    const state: ProjectState = {
      ...newState(),
      currentPhaseId: 1,
      phases: [
        { id: 1, title: 'P1', status: 'doing' },
        { id: 2, title: 'P2', status: 'planned' },
      ],
    };
    await save(state, cwd);
    const before2 = await mtimeOf(cwd, 2);

    const changed: ProjectState = {
      ...state,
      phases: [
        { id: 1, title: 'P1', status: 'done' },
        { id: 2, title: 'P2', status: 'planned' },
      ],
    };
    await save(changed, cwd);

    // fáze 2 se nezměnila → mtime zůstává, fáze 1 nese nový obsah
    expect(await mtimeOf(cwd, 2)).toBe(before2);
    expect((await loadPhase(cwd, 1))?.status).toBe('done');
    // a prev-vrstva drží předchozí podobu fáze 1
    expect((await loadPrev(cwd)).phases[0]?.status).toBe('doing');
  });
});

describe('migrace legacy `model` → `models.default`', () => {
  it('přesune state.model do models.default a pole model odstraní', async () => {
    const legacy: ProjectState = { ...newState(), model: 'claude-opus-4-7' };
    await save(legacy, cwd);

    const loaded = await load(cwd);

    expect(loaded.models?.default).toBe('claude-opus-4-7');
    expect(loaded.model).toBeUndefined();
  });

  it('existující models.default má přednost před legacy model', async () => {
    const legacy: ProjectState = {
      ...newState(),
      model: 'legacy-model',
      models: { default: 'claude-opus-4-7' },
    };
    await save(legacy, cwd);

    const loaded = await load(cwd);

    expect(loaded.models?.default).toBe('claude-opus-4-7');
    expect(loaded.model).toBeUndefined();
  });

  it('stav bez legacy pole nechá beze změny', async () => {
    const clean: ProjectState = { ...newState(), models: { default: 'claude-opus-4-7' } };
    await save(clean, cwd);

    const loaded = await load(cwd);

    expect(loaded.models?.default).toBe('claude-opus-4-7');
    expect(loaded.model).toBeUndefined();
  });

  it('migruje i state.prev.json přes loadPrev', async () => {
    // první save (s legacy polem) ještě prev nevytvoří; druhý save z něj udělá prev
    const legacy: ProjectState = { ...newState(), model: 'claude-opus-4-7' };
    await save(legacy, cwd);
    await save({ ...newState(), currentPhaseId: 1 }, cwd);

    const prev = await loadPrev(cwd);

    expect(prev.models?.default).toBe('claude-opus-4-7');
    expect(prev.model).toBeUndefined();
  });
});
