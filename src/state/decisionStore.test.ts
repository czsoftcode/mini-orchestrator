import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DECISIONS_DIR, decisionExists, decisionPath, readDecision } from './decisionStore.js';

describe('decisionPath', () => {
  it('builds the path from the shared phaseStem (zero-padded)', () => {
    expect(decisionPath('/repo', 7)).toBe(join('/repo', DECISIONS_DIR, 'phase-007.md'));
    expect(decisionPath('/repo', 126)).toBe(join('/repo', DECISIONS_DIR, 'phase-126.md'));
    expect(decisionPath('/repo', 1000)).toBe(join('/repo', DECISIONS_DIR, 'phase-1000.md'));
  });
});

describe('decisionExists / readDecision — file handling', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-decision-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('reports no decision when the file is absent', async () => {
    expect(await decisionExists(cwd, 5)).toBe(false);
    expect(await readDecision(cwd, 5)).toBeNull();
  });

  it('reads the raw markdown of an existing decision', async () => {
    await mkdir(join(cwd, DECISIONS_DIR), { recursive: true });
    const body = '# Warn, not error\n\n## Decision\nUse a warn.\n\n## Why\nOrphaned-doing is a legitimate mid-phase state.';
    await writeFile(decisionPath(cwd, 5), `${body}\n`, 'utf8');

    expect(await decisionExists(cwd, 5)).toBe(true);
    expect(await readDecision(cwd, 5)).toBe(body);
  });

  it('strips a leading BOM and normalizes CRLF line endings', async () => {
    await mkdir(join(cwd, DECISIONS_DIR), { recursive: true });
    await writeFile(decisionPath(cwd, 9), '\uFEFF# Title\r\n\r\nBody line.\r\n', 'utf8');

    expect(await readDecision(cwd, 9)).toBe('# Title\n\nBody line.');
  });

  it('treats a whitespace-only file as no decision', async () => {
    await mkdir(join(cwd, DECISIONS_DIR), { recursive: true });
    await writeFile(decisionPath(cwd, 3), '   \n\n\t\n', 'utf8');

    // The file exists, but it carries no decision.
    expect(await decisionExists(cwd, 3)).toBe(true);
    expect(await readDecision(cwd, 3)).toBeNull();
  });
});
