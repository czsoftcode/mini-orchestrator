import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { offerStatusline } from './install.js';
import { userSettingsPath } from './statuslineSettings.js';

let home: string;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'mini-statusline-offer-'));
});

afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

async function readSettings(): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(userSettingsPath(home), 'utf-8'));
  } catch {
    return null;
  }
}

describe('offerStatusline', () => {
  it('writes nothing without a TTY', async () => {
    await offerStatusline({ home, interactive: false, confirm: async () => true });
    expect(await readSettings()).toBeNull();
  });

  it('installs the statusLine when the user confirms', async () => {
    await offerStatusline({ home, interactive: true, confirm: async () => true });
    const settings = await readSettings();
    expect((settings?.statusLine as { command: string }).command).toContain('statusline');
  });

  it('writes nothing when the user declines', async () => {
    await offerStatusline({ home, interactive: true, confirm: async () => false });
    expect(await readSettings()).toBeNull();
  });

  it('does not prompt or change an existing statusLine', async () => {
    const path = userSettingsPath(home);
    await mkdir(join(home, '.claude'), { recursive: true });
    const original = JSON.stringify({ statusLine: { type: 'command', command: 'mine.sh' } }, null, 2);
    await writeFile(path, original);

    let asked = false;
    await offerStatusline({
      home,
      interactive: true,
      confirm: async () => {
        asked = true;
        return true;
      },
    });

    expect(asked).toBe(false);
    expect(await readFile(path, 'utf-8')).toBe(original);
  });
});
