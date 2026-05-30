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

  it('založí stop signál .mini/STOP', async () => {
    await save(newState(), cwd);
    await stop();
    expect(await fileExists(stopPath(cwd))).toBe(true);
  });

  it('--clear smaže stop signál', async () => {
    await save(newState(), cwd);
    await writeFile(stopPath(cwd), 'x\n', 'utf-8');
    await stop({ clear: true });
    expect(await fileExists(stopPath(cwd))).toBe(false);
  });

  it('je idempotentní v obou směrech', async () => {
    await save(newState(), cwd);
    await stop();
    await stop();
    expect(await fileExists(stopPath(cwd))).toBe(true);
    await stop({ clear: true });
    await stop({ clear: true });
    expect(await fileExists(stopPath(cwd))).toBe(false);
  });

  it('bez projektu nic nezaloží', async () => {
    await stop();
    expect(await fileExists(stopPath(cwd))).toBe(false);
  });
});
