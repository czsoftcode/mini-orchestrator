import { afterEach, describe, expect, it, vi } from 'vitest';
import { completion } from './completion.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('completion command', () => {
  it('writes a bash script and returns true for a supported shell', () => {
    let out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out += String(chunk);
      return true;
    });

    const ok = completion('bash', ['init', 'next']);

    expect(ok).toBe(true);
    expect(out).toContain('complete -F _mini_completion mini');
    expect(out).toContain('init next');
  });

  it('reports an error and returns false for an unsupported shell', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const ok = completion('fish', ['init']);

    expect(ok).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith(expect.stringContaining('Unknown shell "fish"'));
  });
});
