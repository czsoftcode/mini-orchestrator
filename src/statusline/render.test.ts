import { describe, expect, it } from 'vitest';
import {
  renderStatusline,
  shortDir,
  usageBar,
  usageColor,
  usagePercent,
  windowLabel,
} from './render.js';

describe('shortDir', () => {
  it('returns the basename of a path', () => {
    expect(shortDir('/home/me/projects/mini')).toBe('mini');
  });

  it('truncates a long name with an ellipsis', () => {
    expect(shortDir('/x/this-is-a-really-long-directory-name', 10)).toBe('this-is-a…');
  });

  it('returns an empty string for an empty path', () => {
    expect(shortDir('')).toBe('');
  });
});

describe('windowLabel', () => {
  it('labels the 200k window', () => {
    expect(windowLabel(200_000)).toBe('200k');
  });

  it('labels the 1M window', () => {
    expect(windowLabel(1_000_000)).toBe('1M');
  });
});

describe('usagePercent', () => {
  it('computes a rounded percentage', () => {
    expect(usagePercent(50_000, 200_000)).toBe(25);
    expect(usagePercent(1, 1000)).toBe(0);
  });

  it('clamps to 0..100', () => {
    expect(usagePercent(300_000, 200_000)).toBe(100);
    expect(usagePercent(-5, 200_000)).toBe(0);
  });

  it('returns 0 for a zero window', () => {
    expect(usagePercent(10, 0)).toBe(0);
  });
});

describe('usageBar', () => {
  it('fills proportionally', () => {
    expect(usageBar(0, 10)).toBe('▱▱▱▱▱▱▱▱▱▱');
    expect(usageBar(50, 10)).toBe('▰▰▰▰▰▱▱▱▱▱');
    expect(usageBar(100, 10)).toBe('▰▰▰▰▰▰▰▰▰▰');
  });
});

describe('usageColor', () => {
  it('is green below 60%, yellow in 60-85%, red above 85%', () => {
    expect(usageColor(0)).toBe('\x1b[32m');
    expect(usageColor(59)).toBe('\x1b[32m');
    expect(usageColor(60)).toBe('\x1b[33m');
    expect(usageColor(85)).toBe('\x1b[33m');
    expect(usageColor(86)).toBe('\x1b[31m');
    expect(usageColor(100)).toBe('\x1b[31m');
  });
});

describe('renderStatusline', () => {
  it('renders dir, model, window, bar and percent (plain, color off)', () => {
    const line = renderStatusline(
      { dir: '/home/me/mini', model: 'Opus 4.8', usedTokens: 500_000, windowTokens: 1_000_000 },
      { color: false },
    );
    expect(line).toBe('mini · Opus 4.8 · 1M ▰▰▰▰▰▱▱▱▱▱ 50%');
  });

  it('omits an empty dir and empty model', () => {
    const line = renderStatusline(
      { dir: '', model: '', usedTokens: 0, windowTokens: 200_000 },
      { color: false },
    );
    expect(line).toBe('200k ▱▱▱▱▱▱▱▱▱▱ 0%');
  });

  it('appends an upgrade segment when one is available (plain)', () => {
    const line = renderStatusline(
      { dir: '/home/me/mini', model: 'Opus 4.8', usedTokens: 0, windowTokens: 1_000_000, upgrade: '1.9.1' },
      { color: false },
    );
    expect(line).toBe('mini · Opus 4.8 · 1M ▱▱▱▱▱▱▱▱▱▱ 0% · ↑ 1.9.1');
  });

  it('omits the upgrade segment when there is none', () => {
    const line = renderStatusline(
      { dir: '/home/me/mini', model: 'Opus 4.8', usedTokens: 0, windowTokens: 1_000_000, upgrade: null },
      { color: false },
    );
    expect(line).toBe('mini · Opus 4.8 · 1M ▱▱▱▱▱▱▱▱▱▱ 0%');
  });

  it('colors the upgrade segment yellow', () => {
    const line = renderStatusline({
      dir: '/home/me/mini',
      model: 'Opus 4.8',
      usedTokens: 0,
      windowTokens: 1_000_000,
      upgrade: '1.9.1',
    });
    expect(line).toContain('\x1b[33m↑ 1.9.1\x1b[0m');
  });

  it('colors by default: bold-cyan dir, dim separators, threshold-colored gauge', () => {
    const line = renderStatusline({
      dir: '/home/me/mini',
      model: 'Opus 4.8',
      usedTokens: 180_000,
      windowTokens: 200_000, // 90% → red
    });
    expect(line).toContain('\x1b[1;36mmini\x1b[0m'); // bold cyan dir
    expect(line).toContain('\x1b[2m·\x1b[0m'); // dim separator
    expect(line).toContain('\x1b[31m200k ▰▰▰▰▰▰▰▰▰▱ 90%\x1b[0m'); // red gauge
    expect(line).toContain('Opus 4.8'); // model left uncolored
  });
});
