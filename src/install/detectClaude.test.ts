import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectClaude, recommendedScope } from './detectClaude.js';

const CWD = '/proj';
const LOCAL = join(CWD, 'node_modules', '.bin', 'claude');
const GLOBAL = join('/usr/local/bin', 'claude');

/** Builds an `isExecutable` predicate that only treats the listed paths as executables. */
function only(paths: string[]): (p: string) => boolean {
  const set = new Set(paths);
  return (p) => set.has(p);
}

describe('detectClaude', () => {
  it('reports nothing installed when neither local nor global exists', () => {
    const d = detectClaude({ cwd: CWD, pathDirs: ['/usr/local/bin'], isExecutable: only([]) });
    expect(d).toEqual({ installed: false, global: false, local: false });
  });

  it('detects a global install on PATH', () => {
    const d = detectClaude({
      cwd: CWD,
      pathDirs: ['/usr/local/bin'],
      isExecutable: only([GLOBAL]),
    });
    expect(d.installed).toBe(true);
    expect(d.global).toBe(true);
    expect(d.local).toBe(false);
    expect(d.globalPath).toBe(GLOBAL);
  });

  it('detects a local install in node_modules/.bin', () => {
    const d = detectClaude({
      cwd: CWD,
      pathDirs: ['/usr/local/bin'],
      isExecutable: only([LOCAL]),
    });
    expect(d.installed).toBe(true);
    expect(d.local).toBe(true);
    expect(d.global).toBe(false);
    expect(d.localPath).toBe(LOCAL);
  });

  it('detects both global and local at once', () => {
    const d = detectClaude({
      cwd: CWD,
      pathDirs: ['/usr/local/bin'],
      isExecutable: only([LOCAL, GLOBAL]),
    });
    expect(d.global).toBe(true);
    expect(d.local).toBe(true);
  });

  it('returns the first matching PATH directory for the global binary', () => {
    const first = join('/a/bin', 'claude');
    const d = detectClaude({
      cwd: CWD,
      pathDirs: ['/a/bin', '/b/bin'],
      isExecutable: only([first, join('/b/bin', 'claude')]),
    });
    expect(d.globalPath).toBe(first);
  });
});

describe('recommendedScope', () => {
  it('recommends project when only a local install exists', () => {
    expect(recommendedScope({ installed: true, global: false, local: true })).toBe('project');
  });

  it('recommends user when a global install exists', () => {
    expect(recommendedScope({ installed: true, global: true, local: false })).toBe('user');
  });

  it('recommends user when nothing is detected', () => {
    expect(recommendedScope({ installed: false, global: false, local: false })).toBe('user');
  });

  it('recommends user when both exist', () => {
    expect(recommendedScope({ installed: true, global: true, local: true })).toBe('user');
  });
});
