import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skeletonDir } from '../assets.js';
import { syncSkeleton, update } from './update.js';

let cwd: string;

/** Založí minimální projekt (jen .mini/state.json verze 2), jako po migraci. */
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
  it('do prázdného .mini doplní adresáře + .gitignore (bez .gitkeep)', async () => {
    await makeProject(cwd);
    const res = await syncSkeleton(cwd);

    expect(res.createdDirs).toBe(4);
    expect(res.createdFiles).toBe(1);
    expect(res.updatedFiles).toBe(0);

    for (const d of ['discuss', 'memory', 'phases', 'run']) {
      expect(await pathExists(join(cwd, '.mini', d))).toBe(true);
    }
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(true);
    // .gitkeep se do projektu nekopíruje
    expect(await pathExists(join(cwd, '.mini', 'phases', '.gitkeep'))).toBe(false);
  });

  it('.gitignore srovná obsahově na kanonickou podobu (přepíše ruční úpravu)', async () => {
    await makeProject(cwd);
    await writeFile(join(cwd, '.mini', '.gitignore'), 'moje vlastní řádka\n', 'utf-8');

    const res = await syncSkeleton(cwd);
    expect(res.updatedFiles).toBe(1);
    expect(res.createdFiles).toBe(0);

    const canonical = await readFile(join(await skeletonDir(), '.gitignore'), 'utf-8');
    expect(await readFile(join(cwd, '.mini', '.gitignore'), 'utf-8')).toBe(canonical);
  });

  it('je idempotentní — druhý běh nic nezmění', async () => {
    await makeProject(cwd);
    await syncSkeleton(cwd);
    const res = await syncSkeleton(cwd);

    expect(res.createdDirs).toBe(0);
    expect(res.createdFiles).toBe(0);
    expect(res.updatedFiles).toBe(0);
    expect(res.unchangedFiles).toBe(1);
  });

  it('--dry-run nic nezapíše', async () => {
    await makeProject(cwd);
    const res = await syncSkeleton(cwd, { dryRun: true });

    expect(res.createdDirs).toBe(4);
    expect(res.createdFiles).toBe(1);
    expect(await pathExists(join(cwd, '.mini', 'phases'))).toBe(false);
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(false);
  });
});

describe('update', () => {
  it('bez projektu skončí no-project a nic nezaloží', async () => {
    const res = await update(cwd);
    expect(res).toEqual({ ok: false, reason: 'no-project' });
    expect(await pathExists(join(cwd, '.mini'))).toBe(false);
    expect(await pathExists(join(cwd, '.claude'))).toBe(false);
  });

  it('srovná skeleton i slash commandy', async () => {
    await makeProject(cwd);
    const res = await update(cwd);

    expect(res.ok).toBe(true);
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(true);
    const commands = (await readdir(join(cwd, '.claude', 'commands', 'mini'))).sort();
    expect(commands).toContain('next.md');
    expect(commands).toContain('init.md');
    expect(commands).toContain('audit.md');
    expect(commands.length).toBe(10);
  });

  it('--dry-run nic nezapíše ani pro commandy', async () => {
    await makeProject(cwd);
    const res = await update(cwd, { dryRun: true });

    expect(res.ok).toBe(true);
    expect(await pathExists(join(cwd, '.mini', '.gitignore'))).toBe(false);
    expect(await pathExists(join(cwd, '.claude'))).toBe(false);
  });
});
