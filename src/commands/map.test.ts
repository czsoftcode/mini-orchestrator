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
    JSON.stringify({ version: 1, createdAt: new Date().toISOString(), currentPhaseId: null, phases: [] }),
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

  it('warns when project is not TypeScript', async () => {
    await writeFile(join(root, 'package.json'), '{}', 'utf-8');
    await writeFile(join(root, 'index.js'), 'module.exports = {};', 'utf-8');
    const result = await map();
    expect(result).toEqual({ ok: false, reason: 'not-typescript' });
  });

  it('generates .mini/graph.md and reports the file count', async () => {
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
      const graphContent = await readFile(join(root, '.mini', 'graph.md'), 'utf-8');
      expect(graphContent).toContain('## src/a.ts');
      expect(graphContent).toContain('## src/b.ts');
      expect(successLogs.some((l) => l.includes('2'))).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
