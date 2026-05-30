import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renumber } from './renumber.js';
import { executeRenames } from '../state/renumber.js';
import { loadHeader, loadPhase, statePath } from '../state/store.js';

let cwd: string;

const M = (id: number) => join('.mini', 'memory', `phase-${id}`);

/**
 * Reprodukuje smíšené/legacy schéma (jako Symfony projekt vzniklý před fází 60):
 * phases/ paddované .json, discuss/run/memory nepaddované .md, memory s ISO
 * timestampem, desetinná id 1.1/2.1 vedle celých 1/29/30.
 *
 * Fáze v pořadí: 1, 1.1, 2.1, 29, 30 → nová id 1, 2, 3, 4, 5.
 */
async function writeMixedProject(): Promise<void> {
  const mini = join(cwd, '.mini');
  await mkdir(join(mini, 'phases'), { recursive: true });
  await mkdir(join(mini, 'discuss'), { recursive: true });
  await mkdir(join(mini, 'run'), { recursive: true });
  await mkdir(join(mini, 'memory'), { recursive: true });

  const phases = [
    { id: 1, title: 'Employee CRUD', status: 'done' },
    { id: 1.1, title: 'Oprava Employee CRUD', status: 'done' },
    { id: 2.1, title: 'Email při založení', status: 'done' },
    { id: 29, title: 'Zúžit seznam', status: 'done' },
    { id: 30, title: 'Předvyplnění e-mailu', status: 'done' },
  ];
  const header = { version: 2, createdAt: '2026-05-25T11:49:22.383Z', currentPhaseId: null, phases };
  await writeFile(statePath(cwd), JSON.stringify(header, null, 2), 'utf-8');

  // phases/: paddované .json (phaseFileName old: padStart na 3, desetinné zůstanou)
  const phaseFile = (raw: string, id: number, title: string) =>
    writeFile(join(mini, 'phases', `phase-${raw}.json`), JSON.stringify({ id, title, status: 'done' }, null, 2), 'utf-8');
  await phaseFile('001', 1, 'Employee CRUD');
  await phaseFile('1.1', 1.1, 'Oprava Employee CRUD');
  await phaseFile('2.1', 2.1, 'Email při založení');
  await phaseFile('029', 29, 'Zúžit seznam');
  await phaseFile('030', 30, 'Předvyplnění e-mailu');

  // discuss/run: nepaddované
  await writeFile(join(mini, 'discuss', 'phase-1.md'), 'd1', 'utf-8');
  await writeFile(join(mini, 'discuss', 'phase-2.1.md'), 'd2.1', 'utf-8');
  await writeFile(join(mini, 'discuss', 'phase-30.md'), 'd30', 'utf-8');

  await writeFile(join(mini, 'run', 'phase-1.md'), 'r1', 'utf-8');
  await writeFile(join(mini, 'run', 'phase-1.1.prev.md'), 'r1.1prev', 'utf-8');
  await writeFile(join(mini, 'run', 'phase-29.md'), 'r29', 'utf-8');
  await writeFile(join(mini, 'run', 'phase-30.md'), 'r30', 'utf-8');

  // memory: s ISO timestampem
  await writeFile(`${join(cwd, M(1.1))}-2026-05-25T13-05-39.777Z.md`, 'm1.1', 'utf-8');
  await writeFile(`${join(cwd, M(2.1))}-2026-05-25T14-03-43.861Z.md`, 'm2.1', 'utf-8');
  await writeFile(`${join(cwd, M(29))}-2026-05-30T01-31-26.445Z.md`, 'm29', 'utf-8');
}

async function ls(rel: string): Promise<string[]> {
  return (await readdir(join(cwd, '.mini', rel))).sort();
}

async function fileExists(rel: string): Promise<boolean> {
  try {
    await access(join(cwd, '.mini', rel));
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-renumber-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('mini migrate --renumber', () => {
  it('přečísluje na 1..N a sjednotí názvy ve všech adresářích', async () => {
    await writeMixedProject();

    const r = await renumber(cwd, {});
    expect(r.ok).toBe(true);

    // state.json: souvislá celá id, zachované tituly a pořadí
    const header = await loadHeader(cwd);
    expect(header.phases.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(header.phases.map((p) => p.title)).toEqual([
      'Employee CRUD',
      'Oprava Employee CRUD',
      'Email při založení',
      'Zúžit seznam',
      'Předvyplnění e-mailu',
    ]);

    // phase JSONy mají přepsané id + nové názvy; staré (desetinné/posunuté) pryč
    expect(await ls('phases')).toEqual([
      'phase-001.json',
      'phase-002.json',
      'phase-003.json',
      'phase-004.json',
      'phase-005.json',
    ]);
    expect((await loadPhase(cwd, 4))?.title).toBe('Zúžit seznam'); // obsah staré 29 je teď id 4
    expect((await loadPhase(cwd, 5))?.title).toBe('Předvyplnění e-mailu');

    // discuss: 1→001, 2.1→003, 30→005
    expect(await ls('discuss')).toEqual(['phase-001.md', 'phase-003.md', 'phase-005.md']);
    expect(await readFile(join(cwd, '.mini', 'discuss', 'phase-005.md'), 'utf-8')).toBe('d30');

    // run: vč. .prev.md (1.1→002)
    expect(await ls('run')).toEqual(['phase-001.md', 'phase-002.prev.md', 'phase-004.md', 'phase-005.md']);

    // memory: timestamp pryč, 1.1→002, 2.1→003, 29→004
    expect(await ls('memory')).toEqual(['phase-002.md', 'phase-003.md', 'phase-004.md']);
    expect(await readFile(join(cwd, '.mini', 'memory', 'phase-004.md'), 'utf-8')).toBe('m29');
  });

  it('je idempotentní — druhý běh nic nezmění', async () => {
    await writeMixedProject();
    await renumber(cwd, {});
    const before = {
      phases: await ls('phases'),
      discuss: await ls('discuss'),
      run: await ls('run'),
      memory: await ls('memory'),
    };

    const r = await renumber(cwd, {});
    expect(r.ok).toBe(true);
    expect(await ls('phases')).toEqual(before.phases);
    expect(await ls('discuss')).toEqual(before.discuss);
    expect(await ls('run')).toEqual(before.run);
    expect(await ls('memory')).toEqual(before.memory);
  });

  it('dry-run nic nezapíše', async () => {
    await writeMixedProject();
    const r = await renumber(cwd, { dryRun: true });
    expect(r.ok).toBe(true);
    // pořád staré názvy
    expect(await fileExists('phases/phase-1.1.json')).toBe(true);
    expect(await fileExists('phases/phase-002.json')).toBe(false);
    expect((await loadHeader(cwd)).phases.map((p) => p.id)).toEqual([1, 1.1, 2.1, 29, 30]);
  });

  it('zrušené potvrzení nic nezapíše', async () => {
    await writeMixedProject();
    const r = await renumber(cwd, { confirm: async () => false });
    expect(r.ok).toBe(false);
    expect(await fileExists('phases/phase-1.1.json')).toBe(true);
  });

  it('kolize v .md adresáři → abort, nic se nezmění', async () => {
    await writeMixedProject();
    // discuss má i už kanonický phase-001.md vedle phase-1.md → oba míří na phase-001.md
    await writeFile(join(cwd, '.mini', 'discuss', 'phase-001.md'), 'kolize', 'utf-8');

    const r = await renumber(cwd, {});
    expect(r).toMatchObject({ ok: false, reason: 'collision' });
    // stav nedotčen
    expect((await loadHeader(cwd)).phases.map((p) => p.id)).toEqual([1, 1.1, 2.1, 29, 30]);
    expect(await fileExists('discuss/phase-1.md')).toBe(true);
  });
});

describe('executeRenames — kolizně bezpečný swap', () => {
  it('zvládne překryv starých a nových názvů (29↔30 posun)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mini-exec-'));
    await writeFile(join(dir, 'phase-029.md'), 'A', 'utf-8');
    await writeFile(join(dir, 'phase-030.md'), 'B', 'utf-8');

    // 029→030, 030→031 (cíl 030 koliduje se zdrojem druhého renamu)
    await executeRenames(dir, [
      { from: 'phase-029.md', to: 'phase-030.md' },
      { from: 'phase-030.md', to: 'phase-031.md' },
    ]);

    expect(await readFile(join(dir, 'phase-030.md'), 'utf-8')).toBe('A');
    expect(await readFile(join(dir, 'phase-031.md'), 'utf-8')).toBe('B');
    await rm(dir, { recursive: true, force: true });
  });
});
