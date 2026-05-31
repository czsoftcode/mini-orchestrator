import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS_DIR } from './commands.js';

// Force a non-interactive environment (no TTY) for these tests.
vi.mock('../ui/interactive.js', () => ({ isInteractive: () => false }));

import { runPostinstall } from './postinstall.js';

let cwd: string;
let prevInitCwd: string | undefined;
let prevSkip: string | undefined;

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-postinstall-'));
  prevInitCwd = process.env.INIT_CWD;
  prevSkip = process.env.MINI_SKIP_POSTINSTALL;
  process.env.INIT_CWD = cwd;
  delete process.env.MINI_SKIP_POSTINSTALL;
});

afterEach(async () => {
  if (prevInitCwd === undefined) delete process.env.INIT_CWD;
  else process.env.INIT_CWD = prevInitCwd;
  if (prevSkip === undefined) delete process.env.MINI_SKIP_POSTINSTALL;
  else process.env.MINI_SKIP_POSTINSTALL = prevSkip;
  await rm(cwd, { recursive: true, force: true });
});

describe('runPostinstall (non-interactive)', () => {
  it('writes nothing when there is no TTY (only prints a hint)', async () => {
    await runPostinstall();
    expect(await pathExists(join(cwd, COMMANDS_DIR))).toBe(false);
    expect(await pathExists(join(cwd, '.claude'))).toBe(false);
  });

  it('does nothing when MINI_SKIP_POSTINSTALL is set', async () => {
    process.env.MINI_SKIP_POSTINSTALL = '1';
    await runPostinstall();
    expect(await pathExists(join(cwd, '.claude'))).toBe(false);
  });
});
