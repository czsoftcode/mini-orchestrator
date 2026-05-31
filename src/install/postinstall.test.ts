import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS_DIR } from './commands.js';

// Force a non-interactive environment (no TTY) for these tests.
vi.mock('../ui/interactive.js', () => ({ isInteractive: () => false }));

import { isGlobalInstall, runPostinstall } from './postinstall.js';

let cwd: string;
let home: string;
let prevInitCwd: string | undefined;
let prevSkip: string | undefined;
let prevHome: string | undefined;
let prevGlobal: string | undefined;

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
  home = await mkdtemp(join(tmpdir(), 'mini-home-'));
  prevInitCwd = process.env.INIT_CWD;
  prevSkip = process.env.MINI_SKIP_POSTINSTALL;
  prevHome = process.env.HOME;
  prevGlobal = process.env.npm_config_global;
  process.env.INIT_CWD = cwd;
  // Redirect the user home so `~/.claude/...` writes land in a temp dir, not the
  // real one (`os.homedir()` follows $HOME on POSIX).
  process.env.HOME = home;
  delete process.env.MINI_SKIP_POSTINSTALL;
  delete process.env.npm_config_global;
});

afterEach(async () => {
  if (prevInitCwd === undefined) delete process.env.INIT_CWD;
  else process.env.INIT_CWD = prevInitCwd;
  if (prevSkip === undefined) delete process.env.MINI_SKIP_POSTINSTALL;
  else process.env.MINI_SKIP_POSTINSTALL = prevSkip;
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  if (prevGlobal === undefined) delete process.env.npm_config_global;
  else process.env.npm_config_global = prevGlobal;
  await rm(cwd, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

describe('isGlobalInstall', () => {
  it('is true only when npm_config_global is the string "true"', () => {
    expect(isGlobalInstall({ npm_config_global: 'true' })).toBe(true);
    expect(isGlobalInstall({ npm_config_global: 'false' })).toBe(false);
    expect(isGlobalInstall({})).toBe(false);
  });
});

describe('runPostinstall (non-interactive, local/CI install)', () => {
  it('writes nothing when there is no TTY (only prints a hint)', async () => {
    await runPostinstall();
    expect(await pathExists(join(cwd, COMMANDS_DIR))).toBe(false);
    expect(await pathExists(join(cwd, '.claude'))).toBe(false);
    // The user home is left untouched as well.
    expect(await pathExists(join(home, COMMANDS_DIR))).toBe(false);
    expect(await pathExists(join(home, '.claude', 'settings.json'))).toBe(false);
  });

  it('does nothing when MINI_SKIP_POSTINSTALL is set', async () => {
    process.env.MINI_SKIP_POSTINSTALL = '1';
    process.env.npm_config_global = 'true';
    await runPostinstall();
    expect(await pathExists(join(home, '.claude'))).toBe(false);
  });
});

describe('runPostinstall (non-interactive, global install)', () => {
  it('installs the slash commands into the user scope and sets up the status line', async () => {
    process.env.npm_config_global = 'true';
    await runPostinstall();

    // Commands go to ~/.claude/commands/mini, never to the (irrelevant) cwd.
    expect(await pathExists(join(home, COMMANDS_DIR))).toBe(true);
    expect(await pathExists(join(cwd, COMMANDS_DIR))).toBe(false);

    // The status line is wired into ~/.claude/settings.json.
    const settingsPath = join(home, '.claude', 'settings.json');
    expect(await pathExists(settingsPath)).toBe(true);
    const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
    expect(settings.statusLine).toMatchObject({ type: 'command' });
    expect(settings.statusLine.command).toContain('statusline');
  });

  it('never overwrites an existing foreign status line', async () => {
    process.env.npm_config_global = 'true';
    const settingsPath = join(home, '.claude', 'settings.json');
    const foreign = { statusLine: { type: 'command', command: 'my-own-statusline' } };
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(foreign), 'utf8');

    await runPostinstall();

    const settings = JSON.parse(await readFile(settingsPath, 'utf8'));
    expect(settings.statusLine.command).toBe('my-own-statusline');
  });
});
