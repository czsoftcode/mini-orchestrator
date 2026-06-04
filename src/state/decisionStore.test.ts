import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DECISIONS_DIR,
  decisionExists,
  decisionPath,
  hasHeading,
  listDecisionPhaseIds,
  readDecision,
  writeDecision,
} from './decisionStore.js';

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

describe('hasHeading', () => {
  it('accepts a top-level Markdown heading', () => {
    expect(hasHeading('# Title')).toBe(true);
    expect(hasHeading('intro\n# Title\nbody')).toBe(true);
    expect(hasHeading('  # Indented heading')).toBe(true);
    expect(hasHeading('﻿# Title with BOM')).toBe(true);
  });

  it('rejects text without a top-level heading', () => {
    expect(hasHeading('')).toBe(false);
    expect(hasHeading('just a paragraph')).toBe(false);
    expect(hasHeading('## Decision\n## Why')).toBe(false); // only sub-headings
    expect(hasHeading('#nospace')).toBe(false);
    expect(hasHeading('# ')).toBe(false); // heading marker but no text
  });
});

describe('writeDecision — file handling', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-decision-write-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const body = '# Warn, not error\n\n## Decision\nUse a warn.\n\n## Why\nLegit state.';

  it('creates .mini/decisions/ and writes the trimmed body with a trailing newline', async () => {
    // The directory does not exist yet — writeDecision must create it.
    await expect(access(join(cwd, DECISIONS_DIR))).rejects.toThrow();

    const r = await writeDecision(cwd, 7, `  \n${body}\n  `);
    expect(r).toEqual({ ok: true, path: decisionPath(cwd, 7) });
    expect(await decisionExists(cwd, 7)).toBe(true);
    expect(await readDecision(cwd, 7)).toBe(body);
  });

  it('overwrites an existing decision file', async () => {
    await writeDecision(cwd, 7, '# Old\n\n## Decision\nold');
    const r = await writeDecision(cwd, 7, body);
    expect(r.ok).toBe(true);
    expect(await readDecision(cwd, 7)).toBe(body);
  });

  it('writes nothing for an empty / whitespace-only body', async () => {
    expect(await writeDecision(cwd, 4, '   \n\t\n')).toEqual({ ok: false, reason: 'empty' });
    expect(await decisionExists(cwd, 4)).toBe(false);
  });

  it('writes nothing when the body has no top-level heading', async () => {
    expect(await writeDecision(cwd, 4, '## Decision\nfoo\n\n## Why\nbar')).toEqual({
      ok: false,
      reason: 'no-heading',
    });
    expect(await decisionExists(cwd, 4)).toBe(false);
  });
});

describe('listDecisionPhaseIds', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-decision-list-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns an empty set when the decisions directory is missing', async () => {
    expect(await listDecisionPhaseIds(cwd)).toEqual(new Set());
  });

  it('returns an empty set for an empty decisions directory', async () => {
    await mkdir(join(cwd, DECISIONS_DIR), { recursive: true });
    expect(await listDecisionPhaseIds(cwd)).toEqual(new Set());
  });

  it('parses phase-{id}.md filenames back to numeric ids (zero-padded and dotted subphases)', async () => {
    await mkdir(join(cwd, DECISIONS_DIR), { recursive: true });
    for (const file of ['phase-007.md', 'phase-126.md', 'phase-1.5.md', 'phase-1000.md']) {
      await writeFile(join(cwd, DECISIONS_DIR, file), '# x\n', 'utf8');
    }
    expect(await listDecisionPhaseIds(cwd)).toEqual(new Set([7, 126, 1.5, 1000]));
  });

  it('ignores files that do not match the phase-<number>.md shape', async () => {
    await mkdir(join(cwd, DECISIONS_DIR), { recursive: true });
    for (const file of ['phase-007.md', 'README.md', 'phase-.md', 'phase-007.txt', 'notes.md']) {
      await writeFile(join(cwd, DECISIONS_DIR, file), '# x\n', 'utf8');
    }
    expect(await listDecisionPhaseIds(cwd)).toEqual(new Set([7]));
  });
});
