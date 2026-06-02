import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userSettingsPath } from '../install/statuslineSettings.js';
import { installStatuslineCommand } from './install-statusline.js';

let home: string;

async function seedSettings(content: unknown): Promise<string> {
  const path = userSettingsPath(home);
  await mkdir(join(home, '.claude'), { recursive: true });
  await writeFile(path, JSON.stringify(content, null, 2), 'utf-8');
  return path;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'mini-install-statusline-'));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe('installStatuslineCommand', () => {
  it('adds the mini status line when settings.json is missing', async () => {
    await installStatuslineCommand({ home });

    const written = JSON.parse(await readFile(userSettingsPath(home), 'utf-8'));
    expect(written.statusLine).toMatchObject({ type: 'command' });
    expect(written.statusLine.command).toContain('statusline');
  });

  it('preserves other keys when adding the status line', async () => {
    await seedSettings({ model: 'opus' });

    await installStatuslineCommand({ home });

    const written = JSON.parse(await readFile(userSettingsPath(home), 'utf-8'));
    expect(written.model).toBe('opus');
    expect(written.statusLine).toMatchObject({ type: 'command' });
  });

  it('is idempotent when a mini status line is already present', async () => {
    const miniEntry = { type: 'command', command: 'node "/x/dist/cli.js" statusline' };
    const path = await seedSettings({ statusLine: miniEntry });
    const before = await readFile(path, 'utf-8');

    await installStatuslineCommand({ home });

    expect(await readFile(path, 'utf-8')).toBe(before);
  });

  it('leaves a foreign status line untouched', async () => {
    const foreign = { statusLine: { type: 'command', command: 'my-own-statusline' } };
    const path = await seedSettings(foreign);

    await installStatuslineCommand({ home });

    expect(JSON.parse(await readFile(path, 'utf-8'))).toEqual(foreign);
  });

  it('dry-run writes nothing on a missing file', async () => {
    await installStatuslineCommand({ home, dryRun: true });

    await expect(readFile(userSettingsPath(home), 'utf-8')).rejects.toThrow();
  });
});
