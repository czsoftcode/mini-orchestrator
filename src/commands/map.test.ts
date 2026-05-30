import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { map } from './map.js';

async function makeProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mini-map-cmd-'));
  await mkdir(join(root, '.mini'), { recursive: true });
  await writeFile(
    join(root, '.mini', 'state.json'),
    JSON.stringify({ version: 2, createdAt: new Date().toISOString(), currentPhaseId: null, phases: [] }),
    'utf-8',
  );
  return root;
}

describe('map command', () => {
  let originalCwd: string;
  let root: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    root = await makeProject();
    process.chdir(root);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(root, { recursive: true, force: true });
  });

  it('warns when there is no mini project', async () => {
    await rm(join(root, '.mini', 'state.json'));
    const result = await map();
    expect(result).toEqual({ ok: false, reason: 'no-project' });
  });

  it('warns when project has no mappable sources', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf-8');
    await writeFile(join(root, 'styles.css'), 'body{}', 'utf-8');
    await writeFile(join(root, 'README.md'), 'hello', 'utf-8');
    const result = await map();
    expect(result).toEqual({ ok: false, reason: 'not-mappable' });
  });

  it('generates .mini/graph/ + index and reports the file count', async () => {
    await writeFile(join(root, 'tsconfig.json'), '{}', 'utf-8');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 1;', 'utf-8');
    await writeFile(join(root, 'src', 'b.ts'), 'export const b = 2;', 'utf-8');

    const successLogs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      successLogs.push(args.join(' '));
    });

    try {
      const result = await map();
      expect(result.ok).toBe(true);
      const aMap = await readFile(join(root, '.mini', 'graph', 'src', 'a.ts.md'), 'utf-8');
      expect(aMap).toContain('## src/a.ts');
      const bMap = await readFile(join(root, '.mini', 'graph', 'src', 'b.ts.md'), 'utf-8');
      expect(bMap).toContain('## src/b.ts');
      const index = JSON.parse(await readFile(join(root, '.mini', 'graph.json'), 'utf-8'));
      expect(index.files.map((f: { path: string }) => f.path)).toEqual(['src/a.ts', 'src/b.ts']);
      expect(successLogs.some((l) => l.includes('2'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('--file přemapuje jen zadaný soubor (uzel + záznam v indexu)', async () => {
    await writeFile(join(root, 'tsconfig.json'), '{}', 'utf-8');
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 1;', 'utf-8');
    await map(); // plný build → index existuje

    // přidáme nový export do a.ts a přemapujeme jen ten soubor
    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 1;\nexport const a2 = 2;', 'utf-8');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await map(['src/a.ts']);
      expect(result.ok).toBe(true);
    } finally {
      spy.mockRestore();
    }

    const index = JSON.parse(await readFile(join(root, '.mini', 'graph.json'), 'utf-8'));
    expect(index.files.find((f: { path: string }) => f.path === 'src/a.ts')?.exports).toEqual([
      'a',
      'a2',
    ]);
  });

  it('--file v adresáři bez mini projektu tiše neuspěje (no spam)', async () => {
    await rm(join(root, '.mini', 'state.json'));
    const result = await map(['src/a.ts']);
    expect(result).toEqual({ ok: false, reason: 'no-project' });
  });
});
