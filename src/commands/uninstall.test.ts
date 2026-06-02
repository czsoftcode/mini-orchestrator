import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS_DIR } from '../install/commands.js';
import { userSettingsPath } from '../install/statuslineSettings.js';
import { uninstall } from './uninstall.js';

const miniEntry = { type: 'command', command: 'node "/x/dist/cli.js" statusline' };

let cwd: string;
let home: string;

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Creates a (non-empty) commands dir so it looks installed. */
async function seedCommandsDir(base: string): Promise<string> {
  const dir = join(base, COMMANDS_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'do.md'), '# do', 'utf-8');
  return dir;
}

async function seedSettings(content: unknown): Promise<string> {
  const path = userSettingsPath(home);
  await mkdir(join(home, '.claude'), { recursive: true });
  await writeFile(path, JSON.stringify(content, null, 2), 'utf-8');
  return path;
}

beforeEach(async () => {
  cwd = await mkdtempIn('mini-uninstall-cwd-');
  home = await mkdtempIn('mini-uninstall-home-');
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function mkdtempIn(prefix: string): Promise<string> {
  const { mkdtemp } = await import('node:fs/promises');
  return mkdtemp(join(tmpdir(), prefix));
}

describe('uninstall', () => {
  it('removes both command scopes and mini\'s status line (with --yes)', async () => {
    const userDir = await seedCommandsDir(home);
    const projectDir = await seedCommandsDir(cwd);
    const settingsPath = await seedSettings({ model: 'opus', statusLine: miniEntry });

    await uninstall({ cwd, home, yes: true });

    expect(await pathExists(userDir)).toBe(false);
    expect(await pathExists(projectDir)).toBe(false);
    expect(JSON.parse(await readFile(settingsPath, 'utf-8'))).toEqual({ model: 'opus' });
  });

  it('keeps a foreign status line intact', async () => {
    await seedCommandsDir(home);
    const foreign = { statusLine: { type: 'command', command: 'mine.sh' } };
    const settingsPath = await seedSettings(foreign);

    await uninstall({ cwd, home, yes: true });

    expect(JSON.parse(await readFile(settingsPath, 'utf-8'))).toEqual(foreign);
  });

  it('dry-run changes nothing', async () => {
    const userDir = await seedCommandsDir(home);
    const settingsPath = await seedSettings({ statusLine: miniEntry });

    await uninstall({ cwd, home, dryRun: true });

    expect(await pathExists(userDir)).toBe(true);
    expect(JSON.parse(await readFile(settingsPath, 'utf-8'))).toEqual({ statusLine: miniEntry });
  });

  it('does nothing when there is nothing to remove', async () => {
    await uninstall({ cwd, home, yes: true });
    expect(await pathExists(join(home, COMMANDS_DIR))).toBe(false);
    expect(await pathExists(userSettingsPath(home))).toBe(false);
  });

  it('aborts without confirmation when the user declines', async () => {
    const userDir = await seedCommandsDir(home);
    const confirm = vi.fn(async () => false);

    await uninstall({ cwd, home, confirm });

    expect(confirm).toHaveBeenCalledOnce();
    expect(await pathExists(userDir)).toBe(true);
  });

  it('proceeds when an injected confirm resolves true', async () => {
    const userDir = await seedCommandsDir(home);
    const confirm = vi.fn(async () => true);

    await uninstall({ cwd, home, confirm });

    expect(confirm).toHaveBeenCalledOnce();
    expect(await pathExists(userDir)).toBe(false);
  });
});
