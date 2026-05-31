import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newState, save, stopPath } from '../state/store.js';
import { stop } from './stop.js';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('stop', () => {
  let prevCwd: string;
  let cwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-stop-'));
    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('creates the stop signal .mini/STOP', async () => {
    await save(newState(), cwd);
    await stop();
    expect(await fileExists(stopPath(cwd))).toBe(true);
  });

  it('--clear removes the stop signal', async () => {
    await save(newState(), cwd);
    await writeFile(stopPath(cwd), 'x\n', 'utf-8');
    await stop({ clear: true });
    expect(await fileExists(stopPath(cwd))).toBe(false);
  });

  it('is idempotent in both directions', async () => {
    await save(newState(), cwd);
    await stop();
    await stop();
    expect(await fileExists(stopPath(cwd))).toBe(true);
    await stop({ clear: true });
    await stop({ clear: true });
    expect(await fileExists(stopPath(cwd))).toBe(false);
  });

  it('creates nothing without a project', async () => {
    await stop();
    expect(await fileExists(stopPath(cwd))).toBe(false);
  });
});
