import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate } from './migrate.js';
import { load, loadHeader, loadPhase, phaseFileName, phasesDir, statePath } from '../state/store.js';
import type { StateHeader } from '../state/types.js';

let cwd: string;

const LEGACY = {
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  currentPhaseId: 2,
  models: { default: 'claude-opus-4-7' },
  phases: [
    { id: 1, title: 'First', status: 'done', goal: 'goal 1', steps: [{ title: 'a', status: 'done' }] },
    { id: 2, title: 'Second', status: 'doing', goal: 'goal 2', steps: [{ title: 'b', status: 'doing' }] },
  ],
};

async function writeLegacy(): Promise<void> {
  await mkdir(join(cwd, '.mini'), { recursive: true });
  await writeFile(statePath(cwd), JSON.stringify(LEGACY, null, 2), 'utf-8');
}

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-migrate-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('mini migrate', () => {
  it('splits the old monolithic state.json (version 1) into the new layout', async () => {
    await writeLegacy();

    const r = await migrate(cwd);
    expect(r.ok).toBe(true);

    // Header: version 2, lightweight index, metadata preserved.
    const header = JSON.parse(await readFile(statePath(cwd), 'utf-8')) as StateHeader;
    expect(header.version).toBe(2);
    expect(header.currentPhaseId).toBe(2);
    expect(header.phases).toEqual([
      { id: 1, title: 'First', status: 'done' },
      { id: 2, title: 'Second', status: 'doing' },
    ]);
    // no detail in the header
    expect((header.phases[0] as Record<string, unknown>).steps).toBeUndefined();

    // Phase files were created and hold the full detail.
    const files = await readdir(phasesDir(cwd));
    expect(files).toContain(phaseFileName(1));
    expect(files).toContain(phaseFileName(2));
    expect((await loadPhase(cwd, 1))?.goal).toBe('goal 1');
    expect((await loadPhase(cwd, 2))?.steps?.[0]?.status).toBe('doing');
  });

  it('after migration the state loads via load() and matches', async () => {
    await writeLegacy();
    await migrate(cwd);

    const state = await load(cwd);
    expect(state.version).toBe(2);
    expect(state.phases).toHaveLength(2);
    expect(state.currentPhaseId).toBe(2);
    expect(state.models?.default).toBe('claude-opus-4-7');
    expect(state.phases[1]?.goal).toBe('goal 2');
  });

  it('is idempotent — a second run on version 2 is a no-op', async () => {
    await writeLegacy();
    await migrate(cwd);
    const headerAfterFirst = await readFile(statePath(cwd), 'utf-8');

    const r = await migrate(cwd);
    expect(r.ok).toBe(true);
    expect(await readFile(statePath(cwd), 'utf-8')).toBe(headerAfterFirst);
  });

  it('returns ok:false without a project', async () => {
    const r = await migrate(cwd);
    expect(r).toEqual({ ok: false, reason: 'no-project' });
  });

  it('migration keeps the model→models migration on read', async () => {
    await mkdir(join(cwd, '.mini'), { recursive: true });
    await writeFile(
      statePath(cwd),
      JSON.stringify({ version: 1, createdAt: 'x', currentPhaseId: null, model: 'legacy-m', phases: [] }),
      'utf-8',
    );

    await migrate(cwd);

    // the header holds the legacy `model`, loadHeader moves it into models.default on read
    const header = await loadHeader(cwd);
    expect(header.models?.default).toBe('legacy-m');
    expect(header.model).toBeUndefined();
  });
});
