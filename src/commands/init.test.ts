import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Replace the prompts with fixed answers so init runs non-interactively.
vi.mock('../ui/ask.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/ask.js')>();
  return {
    ...actual,
    ask: vi.fn(async () => ({
      name: 'Test project',
      what: 'Something useful',
      forWhom: 'For developers',
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
  it('creates project.md + state.json and lays down the skeleton (.gitignore + directories)', async () => {
    await init();

    // generated per-project files
    expect(await pathExists(join(cwd, '.mini', 'project.md'))).toBe(true);
    expect(await pathExists(join(cwd, '.mini', 'state.json'))).toBe(true);
    const projectMd = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(projectMd).toContain('Test project');

    // skeleton
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(true);
    for (const d of ['discuss', 'memory', 'phases', 'run']) {
      expect(await pathExists(join(cwd, '.mini', d))).toBe(true);
    }
    // .gitkeep is not copied into the project
    expect(await pathExists(join(cwd, '.mini', 'phases', '.gitkeep'))).toBe(false);
  });
});

describe('applyInit (non-interactive)', () => {
  it('creates project.md + state.json and lays down the skeleton without ask prompts', async () => {
    const r = await applyInit({
      name: 'From flags',
      what: 'Something from flags',
      forWhom: 'For CI',
      constraints: 'No interaction',
    });

    expect(r.ok).toBe(true);
    expect(await pathExists(join(cwd, '.mini', 'project.md'))).toBe(true);
    expect(await pathExists(join(cwd, '.mini', 'state.json'))).toBe(true);
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(true);
    const projectMd = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(projectMd).toContain('From flags');
    expect(projectMd).toContain('Something from flags');
  });

  it('fills the name from the directory and replaces an empty constraint with a placeholder', async () => {
    await applyInit({ what: 'What', forWhom: 'For whom' });
    const projectMd = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    // without --name the temp directory name is used
    expect(projectMd).toContain(`# ${join(cwd).split('/').pop()}`);
    expect(projectMd).toContain('(none)');
  });

  it('fails and does not overwrite an existing project without --force', async () => {
    await applyInit({ what: 'Original', forWhom: 'A' });
    const before = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');

    const r = await applyInit({ what: 'New', forWhom: 'B' });
    expect(r.ok).toBe(false);
    const after = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(after).toBe(before);
  });

  it('overwrites an existing project with --force', async () => {
    await applyInit({ what: 'Original', forWhom: 'A' });
    const r = await applyInit({ what: 'New wording', forWhom: 'B', force: true });
    expect(r.ok).toBe(true);
    const after = await readFile(join(cwd, '.mini', 'project.md'), 'utf-8');
    expect(after).toContain('New wording');
  });

  it('offers mini map and mini audit in the output in a brownfield directory', async () => {
    await writeFile(join(cwd, 'index.ts'), 'export const x = 1;\n', 'utf-8');
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      logs.push(a.join(' '));
    });
    try {
      await applyInit({ what: 'What', forWhom: 'For whom' });
    } finally {
      spy.mockRestore();
    }
    const out = logs.join('\n');
    expect(out).toContain('mini map');
    expect(out).toContain('mini audit');
  });
});
