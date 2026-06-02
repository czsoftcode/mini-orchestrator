import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installStatusline,
  isMiniStatusline,
  mergeStatusline,
  miniStatuslineCommand,
  removeStatusline,
  removeStatuslineFromSettings,
  userSettingsPath,
} from './statuslineSettings.js';

/** A realistic mini statusLine entry, as installStatusline would write it. */
const miniEntry = { type: 'command', command: 'node "/x/dist/cli.js" statusline' };

describe('userSettingsPath', () => {
  it('points at ~/.claude/settings.json', () => {
    expect(userSettingsPath('/home/me')).toBe(join('/home/me', '.claude', 'settings.json'));
  });
});

describe('miniStatuslineCommand', () => {
  it('is an absolute node invocation ending in the statusline subcommand', () => {
    const cmd = miniStatuslineCommand();
    expect(cmd.startsWith('node "')).toBe(true);
    expect(cmd.endsWith('statusline')).toBe(true);
    expect(cmd).toContain('cli.js');
  });
});

describe('mergeStatusline', () => {
  it('adds the statusLine when none exists, keeping other keys', () => {
    const res = mergeStatusline({ model: 'opus' }, 'node x statusline');
    expect(res.changed).toBe(true);
    expect(res.reason).toBe('added');
    expect(res.settings).toEqual({
      model: 'opus',
      statusLine: { type: 'command', command: 'node x statusline' },
    });
  });

  it('never overwrites an existing (foreign) statusLine', () => {
    const existing = { statusLine: { type: 'command', command: 'bash other.sh' } };
    const res = mergeStatusline(existing, 'node x statusline');
    expect(res.changed).toBe(false);
    expect(res.reason).toBe('exists');
    expect(res.settings).toBe(existing);
  });

  it('treats an already-present mini statusLine as nothing to do (idempotent)', () => {
    const existing = { statusLine: { type: 'command', command: 'node x statusline' } };
    const res = mergeStatusline(existing, 'node x statusline');
    expect(res.changed).toBe(false);
    expect(res.reason).toBe('exists');
  });
});

describe('installStatusline', () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'mini-statusline-settings-'));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it('creates settings.json with the statusLine when the file is missing', async () => {
    const res = await installStatusline({ home, command: 'node x statusline' });
    expect(res.changed).toBe(true);
    expect(res.reason).toBe('added');

    const written = JSON.parse(await readFile(userSettingsPath(home), 'utf-8'));
    expect(written.statusLine).toEqual({ type: 'command', command: 'node x statusline' });
  });

  it('preserves other keys and uses a 2-space indent + trailing newline', async () => {
    const path = userSettingsPath(home);
    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(path, JSON.stringify({ model: 'opus', theme: 'dark' }, null, 2));

    await installStatusline({ home, command: 'node x statusline' });
    const raw = await readFile(path, 'utf-8');

    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  "model": "opus"');
    const parsed = JSON.parse(raw);
    expect(parsed.model).toBe('opus');
    expect(parsed.theme).toBe('dark');
    expect(parsed.statusLine.command).toBe('node x statusline');
  });

  it('leaves an existing statusLine untouched', async () => {
    const path = userSettingsPath(home);
    await mkdir(join(home, '.claude'), { recursive: true });
    const original = JSON.stringify({ statusLine: { type: 'command', command: 'mine.sh' } }, null, 2);
    await writeFile(path, original);

    const res = await installStatusline({ home, command: 'node x statusline' });
    expect(res.changed).toBe(false);
    expect(res.reason).toBe('exists');
    expect(await readFile(path, 'utf-8')).toBe(original);
  });

  it('dry-run writes nothing', async () => {
    const res = await installStatusline({ home, command: 'node x statusline', dryRun: true });
    expect(res.changed).toBe(true);
    await expect(readFile(userSettingsPath(home), 'utf-8')).rejects.toThrow();
  });

  it('recovers from a malformed settings.json by starting fresh', async () => {
    const path = userSettingsPath(home);
    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(path, '{ not valid json ');

    const res = await installStatusline({ home, command: 'node x statusline' });
    expect(res.changed).toBe(true);
    const written = JSON.parse(await readFile(path, 'utf-8'));
    expect(written.statusLine.command).toBe('node x statusline');
  });
});

describe('isMiniStatusline', () => {
  it('recognizes mini\'s own node "…/cli.js" statusline entry', () => {
    expect(isMiniStatusline(miniEntry)).toBe(true);
  });

  it('does not match a foreign entry that merely contains "statusline"', () => {
    expect(isMiniStatusline({ type: 'command', command: 'my-own-statusline' })).toBe(false);
    expect(isMiniStatusline({ type: 'command', command: 'bash other.sh' })).toBe(false);
  });

  it('rejects non-command / non-object entries', () => {
    expect(isMiniStatusline(undefined)).toBe(false);
    expect(isMiniStatusline(null)).toBe(false);
    expect(isMiniStatusline('node x cli.js statusline')).toBe(false);
    expect(isMiniStatusline({ type: 'static', command: 'node /x/cli.js statusline' })).toBe(false);
  });
});

describe('removeStatusline', () => {
  it('removes mini\'s statusLine, keeping other keys', () => {
    const res = removeStatusline({ model: 'opus', statusLine: miniEntry });
    expect(res.changed).toBe(true);
    expect(res.reason).toBe('removed');
    expect(res.settings).toEqual({ model: 'opus' });
  });

  it('leaves a foreign statusLine untouched', () => {
    const settings = { statusLine: { type: 'command', command: 'mine.sh' } };
    const res = removeStatusline(settings);
    expect(res.changed).toBe(false);
    expect(res.reason).toBe('foreign');
    expect(res.settings).toBe(settings);
  });

  it('reports absent when there is no statusLine', () => {
    const settings = { model: 'opus' };
    const res = removeStatusline(settings);
    expect(res.changed).toBe(false);
    expect(res.reason).toBe('absent');
    expect(res.settings).toBe(settings);
  });
});

describe('removeStatuslineFromSettings', () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'mini-statusline-remove-'));
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it('strips mini\'s statusLine and preserves other keys', async () => {
    const path = userSettingsPath(home);
    await mkdir(join(home, '.claude'), { recursive: true });
    await writeFile(path, JSON.stringify({ model: 'opus', statusLine: miniEntry }, null, 2));

    const res = await removeStatuslineFromSettings({ home });
    expect(res.changed).toBe(true);
    expect(res.reason).toBe('removed');

    const written = JSON.parse(await readFile(path, 'utf-8'));
    expect(written).toEqual({ model: 'opus' });
  });

  it('leaves a foreign statusLine in place', async () => {
    const path = userSettingsPath(home);
    await mkdir(join(home, '.claude'), { recursive: true });
    const original = JSON.stringify({ statusLine: { type: 'command', command: 'mine.sh' } }, null, 2);
    await writeFile(path, original);

    const res = await removeStatuslineFromSettings({ home });
    expect(res.changed).toBe(false);
    expect(res.reason).toBe('foreign');
    expect(await readFile(path, 'utf-8')).toBe(original);
  });

  it('reports missing when the file does not exist', async () => {
    const res = await removeStatuslineFromSettings({ home });
    expect(res.changed).toBe(false);
    expect(res.reason).toBe('missing');
  });

  it('dry-run writes nothing', async () => {
    const path = userSettingsPath(home);
    await mkdir(join(home, '.claude'), { recursive: true });
    const original = JSON.stringify({ statusLine: miniEntry }, null, 2);
    await writeFile(path, original);

    const res = await removeStatuslineFromSettings({ home, dryRun: true });
    expect(res.changed).toBe(true);
    expect(await readFile(path, 'utf-8')).toBe(original);
  });
});
