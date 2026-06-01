import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changelog } from './changelog.js';

const SAMPLE = `# Changelog

## [Unreleased]

### Added

- pending feature

## [1.2.0] - 2026-02-01

### Added

- shipped feature

## [1.1.0] - 2026-01-01

### Fixed

- old bug
`;

describe('changelog', () => {
  let prevCwd: string;
  let cwd: string;
  let out: string;
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-cl-'));
    process.chdir(cwd);
    out = '';
    spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      out += `${a.join(' ')}\n`;
    });
  });

  afterEach(async () => {
    spy.mockRestore();
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('defaults to the latest released section', async () => {
    await writeFile(join(cwd, 'CHANGELOG.md'), SAMPLE, 'utf-8');
    await changelog();
    expect(out).toContain('[1.2.0] - 2026-02-01');
    expect(out).toContain('- shipped feature');
    expect(out).not.toContain('- old bug');
    expect(out).not.toContain('- pending feature');
  });

  it('--unreleased prints the pending section', async () => {
    await writeFile(join(cwd, 'CHANGELOG.md'), SAMPLE, 'utf-8');
    await changelog({ unreleased: true });
    expect(out).toContain('[Unreleased]');
    expect(out).toContain('- pending feature');
    expect(out).not.toContain('- shipped feature');
  });

  it('--all prints the whole changelog', async () => {
    await writeFile(join(cwd, 'CHANGELOG.md'), SAMPLE, 'utf-8');
    await changelog({ all: true });
    expect(out).toContain('- pending feature');
    expect(out).toContain('- shipped feature');
    expect(out).toContain('- old bug');
  });

  it('reports a missing changelog gracefully', async () => {
    await changelog();
    expect(out).toContain('No CHANGELOG.md');
  });
});
