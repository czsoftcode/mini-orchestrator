import { describe, expect, it } from 'vitest';
import { buildData, extractUsage, windowForModel } from './statusline.js';

describe('windowForModel', () => {
  it('gives 1M to any Sonnet 4.x', () => {
    expect(windowForModel('Sonnet 4.6')).toBe(1_000_000);
    expect(windowForModel('Sonnet 4.0')).toBe(1_000_000);
  });

  it('gives 1M to Opus from 4.7 onward', () => {
    expect(windowForModel('Opus 4.7')).toBe(1_000_000);
    expect(windowForModel('Opus 4.8')).toBe(1_000_000);
    expect(windowForModel('Opus 5.0')).toBe(1_000_000);
  });

  it('keeps older Opus at 200k', () => {
    expect(windowForModel('Opus 4.6')).toBe(200_000);
    expect(windowForModel('Opus 4.1')).toBe(200_000);
  });

  it('keeps Haiku at 200k regardless of version', () => {
    expect(windowForModel('Haiku 4.5')).toBe(200_000);
  });

  it('falls back to 200k for an unrecognized / version-less name', () => {
    expect(windowForModel('')).toBe(200_000);
    expect(windowForModel('Some Model')).toBe(200_000);
  });
});

describe('extractUsage', () => {
  const line = (usage: Record<string, number>): string =>
    JSON.stringify({ message: { usage } });

  it('sums input + both cache token counts of the last usage entry', () => {
    const transcript = [
      line({ input_tokens: 10, cache_read_input_tokens: 20, cache_creation_input_tokens: 5 }),
      line({ input_tokens: 100, cache_read_input_tokens: 200, cache_creation_input_tokens: 50 }),
    ].join('\n');
    expect(extractUsage(transcript)).toBe(350);
  });

  it('ignores output tokens', () => {
    const transcript = JSON.stringify({
      message: { usage: { input_tokens: 10, output_tokens: 999 } },
    });
    expect(extractUsage(transcript)).toBe(10);
  });

  it('skips malformed lines and blank lines', () => {
    const transcript = ['not json', '', line({ input_tokens: 42 }), '   '].join('\n');
    expect(extractUsage(transcript)).toBe(42);
  });

  it('returns 0 when there is no usage entry', () => {
    expect(extractUsage('')).toBe(0);
    expect(extractUsage(JSON.stringify({ message: {} }))).toBe(0);
  });
});

describe('buildData', () => {
  it('normalizes cwd, model and usage', () => {
    const data = buildData(
      { cwd: '/home/me/project', model: { display_name: 'Opus 4.8' } },
      JSON.stringify({ message: { usage: { input_tokens: 1000 } } }),
    );
    expect(data).toEqual({
      dir: '/home/me/project',
      model: 'Opus 4.8',
      usedTokens: 1000,
      windowTokens: 1_000_000,
      upgrade: null,
    });
  });

  it('passes the upgrade version through when given', () => {
    const data = buildData({ cwd: '/x' }, '', '1.9.1');
    expect(data.upgrade).toBe('1.9.1');
  });

  it('defaults upgrade to null when omitted', () => {
    expect(buildData({ cwd: '/x' }, '').upgrade).toBeNull();
  });

  it('falls back to workspace.current_dir when cwd is missing', () => {
    const data = buildData({ workspace: { current_dir: '/ws/dir' } }, '');
    expect(data.dir).toBe('/ws/dir');
  });

  it('auto-escalates the window to 1M when usage exceeds the base 200k', () => {
    const transcript = JSON.stringify({
      message: { usage: { input_tokens: 250_000 } },
    });
    const data = buildData({ model: { display_name: 'Opus 4.6' } }, transcript);
    expect(data.windowTokens).toBe(1_000_000);
  });

  it('handles an empty payload without throwing', () => {
    const data = buildData({}, '');
    expect(data).toEqual({ dir: '', model: '', usedTokens: 0, windowTokens: 200_000, upgrade: null });
  });
});
