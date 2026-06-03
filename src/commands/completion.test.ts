import { afterEach, describe, expect, it, vi } from 'vitest';
import { completion } from './completion.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('completion command', () => {
  it('writes a bash script with command names and flags, returns true', () => {
    let out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out += String(chunk);
      return true;
    });

    const ok = completion('bash', [
      { name: 'init', flags: [{ name: '--apply' }] },
      { name: 'done', flags: [{ name: '--bump', values: ['none', 'patch'] }] },
    ]);

    expect(ok).toBe(true);
    expect(out).toContain('complete -F _mini_completion mini');
    expect(out).toContain('init done');
    expect(out).toContain('init) flags="--apply" ;;');
    expect(out).toContain('done:--bump) COMPREPLY=( $(compgen -W "none patch"');
  });

  it('reports an error and returns false for an unsupported shell', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const ok = completion('fish', [{ name: 'init', flags: [{ name: '--apply' }] }]);

    expect(ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('Unknown shell "fish"'));
  });
});
