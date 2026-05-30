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
    { id: 1, title: 'První', status: 'done', goal: 'cíl 1', steps: [{ title: 'a', status: 'done' }] },
    { id: 2, title: 'Druhá', status: 'doing', goal: 'cíl 2', steps: [{ title: 'b', status: 'doing' }] },
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
  it('rozdělí starý monolitický state.json (verze 1) do nového layoutu', async () => {
    await writeLegacy();

    const r = await migrate(cwd);
    expect(r.ok).toBe(true);

    // Hlavička: verze 2, lehký index, metadata zachována.
    const header = JSON.parse(await readFile(statePath(cwd), 'utf-8')) as StateHeader;
    expect(header.version).toBe(2);
    expect(header.currentPhaseId).toBe(2);
    expect(header.phases).toEqual([
      { id: 1, title: 'První', status: 'done' },
      { id: 2, title: 'Druhá', status: 'doing' },
    ]);
    // detail v hlavičce není
    expect((header.phases[0] as Record<string, unknown>).steps).toBeUndefined();

    // Soubory fází vznikly a drží plný detail.
    const files = await readdir(phasesDir(cwd));
    expect(files).toContain(phaseFileName(1));
    expect(files).toContain(phaseFileName(2));
    expect((await loadPhase(cwd, 1))?.goal).toBe('cíl 1');
    expect((await loadPhase(cwd, 2))?.steps?.[0]?.status).toBe('doing');
  });

  it('po migraci jde stav načíst přes load() a sedí', async () => {
    await writeLegacy();
    await migrate(cwd);

    const state = await load(cwd);
    expect(state.version).toBe(2);
    expect(state.phases).toHaveLength(2);
    expect(state.currentPhaseId).toBe(2);
    expect(state.models?.default).toBe('claude-opus-4-7');
    expect(state.phases[1]?.goal).toBe('cíl 2');
  });

  it('je idempotentní — druhý běh na verzi 2 je no-op', async () => {
    await writeLegacy();
    await migrate(cwd);
    const headerAfterFirst = await readFile(statePath(cwd), 'utf-8');

    const r = await migrate(cwd);
    expect(r.ok).toBe(true);
    expect(await readFile(statePath(cwd), 'utf-8')).toBe(headerAfterFirst);
  });

  it('bez projektu vrátí ok:false', async () => {
    const r = await migrate(cwd);
    expect(r).toEqual({ ok: false, reason: 'no-project' });
  });

  it('migrace zachová model→models migraci při čtení', async () => {
    await mkdir(join(cwd, '.mini'), { recursive: true });
    await writeFile(
      statePath(cwd),
      JSON.stringify({ version: 1, createdAt: 'x', currentPhaseId: null, model: 'legacy-m', phases: [] }),
      'utf-8',
    );

    await migrate(cwd);

    // hlavička drží legacy `model`, loadHeader ho při čtení přesune do models.default
    const header = await loadHeader(cwd);
    expect(header.models?.default).toBe('legacy-m');
    expect(header.model).toBeUndefined();
  });
});
