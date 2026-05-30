import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
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

import { init } from './init.js';

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
