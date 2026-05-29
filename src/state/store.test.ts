import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exists,
  hasPrev,
  load,
  loadPrev,
  newState,
  restorePrev,
  save,
  statePath,
  statePrevPath,
} from './store.js';
import type { ProjectState } from './types.js';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-store-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
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
