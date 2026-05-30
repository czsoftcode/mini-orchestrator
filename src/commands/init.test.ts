import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Prompty nahradíme pevnými odpověďmi, ať init běží neinteraktivně.
vi.mock('../ui/ask.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/ask.js')>();
  return {
    ...actual,
    ask: vi.fn(async () => ({
      name: 'Testovací projekt',
      what: 'Něco užitečného',
      forWhom: 'Pro vývojáře',
      constraints: 'TypeScript',
    })),
  };
});

import { applyInit, init } from './init.js';

let cwd: string;
let prevCwd: string;

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-init-'));
  prevCwd = process.cwd();
  process.chdir(cwd);
});

afterEach(async () => {
  process.chdir(prevCwd);
  await rm(cwd, { recursive: true, force: true });
});

describe('init', () => {
  it('založí project.md + state.json a položí skeleton (.gitignore + adresáře)', async () => {
    await init();

    // generované per-projekt soubory
    expect(await pathExists(join(cwd, '.mini', 'project.md'))).toBe(true);
    expect(await pathExists(join(cwd, '.mini', 'state.json'))).toBe(true);
    const projectMd = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(projectMd).toContain('Testovací projekt');

    // skeleton
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(true);
    for (const d of ['discuss', 'memory', 'phases', 'run']) {
      expect(await pathExists(join(cwd, '.mini', d))).toBe(true);
    }
    // .gitkeep se do projektu nekopíruje
    expect(await pathExists(join(cwd, '.mini', 'phases', '.gitkeep'))).toBe(false);
  });
});

describe('applyInit (neinteraktivní)', () => {
  it('založí project.md + state.json a položí skeleton bez ask promptů', async () => {
    const r = await applyInit({
      name: 'Z flagů',
      what: 'Něco z flagů',
      forWhom: 'Pro CI',
      constraints: 'Bez interakce',
    });

    expect(r.ok).toBe(true);
    expect(await pathExists(join(cwd, '.mini', 'project.md'))).toBe(true);
    expect(await pathExists(join(cwd, '.mini', 'state.json'))).toBe(true);
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(true);
    const projectMd = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(projectMd).toContain('Z flagů');
    expect(projectMd).toContain('Něco z flagů');
  });

  it('název doplní z adresáře a prázdné omezení nahradí placeholderem', async () => {
    await applyInit({ what: 'Co', forWhom: 'Pro koho' });
    const projectMd = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    // bez --name se vezme název temp adresáře
    expect(projectMd).toContain(`# ${join(cwd).split('/').pop()}`);
    expect(projectMd).toContain('(žádné)');
  });

  it('na existujícím projektu bez --force selže a nepřepíše', async () => {
    await applyInit({ what: 'Původní', forWhom: 'A' });
    const before = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');

    const r = await applyInit({ what: 'Nové', forWhom: 'B' });
    expect(r.ok).toBe(false);
    const after = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(after).toBe(before);
  });

  it('s --force existující projekt přepíše', async () => {
    await applyInit({ what: 'Původní', forWhom: 'A' });
    const r = await applyInit({ what: 'Nové znění', forWhom: 'B', force: true });
    expect(r.ok).toBe(true);
    const after = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(after).toContain('Nové znění');
  });

  it('v brownfield adresáři nabídne v outputu mini map a mini audit', async () => {
    await writeFile(join(cwd, 'index.ts'), 'export const x = 1;\n', 'utf-8');
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      logs.push(a.join(' '));
    });
    try {
      await applyInit({ what: 'Co', forWhom: 'Pro koho' });
    } finally {
      spy.mockRestore();
    }
    const out = logs.join('\n');
    expect(out).toContain('mini map');
    expect(out).toContain('mini audit');
  });
});
