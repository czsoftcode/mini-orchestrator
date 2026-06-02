import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skeletonDir } from '../assets.js';
import { syncSkeleton } from './update.js';

let cwd: string;

/** Creates a minimal project (only .mini/state.json version 2), as after a migration. */
async function makeProject(dir: string): Promise<void> {
  await mkdir(join(dir, '.mini'), { recursive: true });
  await writeFile(
    join(dir, '.mini', 'state.json'),
    JSON.stringify({ version: 2, createdAt: 'x', currentPhaseId: null, phases: [] }),
    'utf-8',
  );
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-update-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('syncSkeleton', () => {
  it('fills an empty .mini with directories + .gitignore (without .gitkeep)', async () => {
    await makeProject(cwd);
    const res = await syncSkeleton(cwd);

    expect(res.createdDirs).toBe(4);
    expect(res.createdFiles).toBe(1);
    expect(res.updatedFiles).toBe(0);

    for (const d of ['discuss', 'memory', 'phases', 'run']) {
      expect(await pathExists(join(cwd, '.mini', d))).toBe(true);
    }
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(true);
    // .gitkeep is not copied into the project
    expect(await pathExists(join(cwd, '.mini', 'phases', '.gitkeep'))).toBe(false);
  });

  it('syncs .gitignore by content to the canonical form (overwrites a manual edit)', async () => {
    await makeProject(cwd);
    await writeFile(join(cwd, '.mini', '.gitignore'), 'my own line\n', 'utf-8');

    const res = await syncSkeleton(cwd);
    expect(res.updatedFiles).toBe(1);
    expect(res.createdFiles).toBe(0);

    // The skeleton source on disk is `gitignore` (no dot), the project target is `.gitignore`.
    const canonical = await readFile(join(await skeletonDir(), 'gitignore'), 'utf-8');
    expect(await readFile(join(cwd, '.mini', '.gitignore'), 'utf-8')).toBe(canonical);
  });

  it('is idempotent — the second run changes nothing', async () => {
    await makeProject(cwd);
    await syncSkeleton(cwd);
    const res = await syncSkeleton(cwd);

    expect(res.createdDirs).toBe(0);
    expect(res.createdFiles).toBe(0);
    expect(res.updatedFiles).toBe(0);
    expect(res.unchangedFiles).toBe(1);
  });

  it('--dry-run writes nothing', async () => {
    await makeProject(cwd);
    const res = await syncSkeleton(cwd, { dryRun: true });

    expect(res.createdDirs).toBe(4);
    expect(res.createdFiles).toBe(1);
    expect(await pathExists(join(cwd, '.mini', 'phases'))).toBe(false);
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(false);
  });
});
