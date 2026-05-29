import { describe, expect, it } from 'vitest';
import { CLAUDE_NOT_FOUND_MESSAGE, describeSpawnError } from './spawnError.js';

describe('describeSpawnError (R3)', () => {
  it('ENOENT přeloží na srozumitelný návod na instalaci', () => {
    const err: NodeJS.ErrnoException = new Error('spawn claude ENOENT');
    err.code = 'ENOENT';
    const out = describeSpawnError(err);
    expect(out.message).toBe(CLAUDE_NOT_FOUND_MESSAGE);
    expect(out.message).toContain('claude.com/claude-code');
    expect(out.message).not.toContain('spawn claude ENOENT');
  });

  it('ostatní chyby zabalí jednotně', () => {
    const err: NodeJS.ErrnoException = new Error('EACCES permission denied');
    err.code = 'EACCES';
    const out = describeSpawnError(err);
    expect(out.message).toBe('Nepodařilo se spustit claude: EACCES permission denied');
  });
});
