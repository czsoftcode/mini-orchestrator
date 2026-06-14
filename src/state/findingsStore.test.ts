import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FINDINGS_DIR,
  type Finding,
  addFinding,
  findingsPath,
  isFindingSeverity,
  listFindings,
  parseFindings,
  readPhaseFindings,
  serializeFindings,
} from './findingsStore.js';

describe('findingsPath', () => {
  it('builds the path from the shared phaseStem (zero-padded)', () => {
    expect(findingsPath('/repo', 7)).toBe(join('/repo', FINDINGS_DIR, 'phase-007.md'));
    expect(findingsPath('/repo', 155)).toBe(join('/repo', FINDINGS_DIR, 'phase-155.md'));
    expect(findingsPath('/repo', 1000)).toBe(join('/repo', FINDINGS_DIR, 'phase-1000.md'));
  });
});

describe('isFindingSeverity', () => {
  it('accepts the three known severities and rejects anything else', () => {
    expect(isFindingSeverity('blocker')).toBe(true);
    expect(isFindingSeverity('should-know')).toBe(true);
    expect(isFindingSeverity('nit')).toBe(true);
    expect(isFindingSeverity('critical')).toBe(false);
    expect(isFindingSeverity('')).toBe(false);
  });
});

describe('parse ↔ serialize round-trip', () => {
  it('round-trips a finding with where + title + body', () => {
    const findings: Finding[] = [
      {
        id: '155-1',
        phaseId: 155,
        severity: 'should-know',
        status: 'open',
        where: 'src/foo.ts:42',
        title: 'Null cascades silently',
        body: 'When input is empty the parser returns undefined and the caller crashes later.',
      },
    ];
    expect(parseFindings(serializeFindings(findings))).toEqual(findings);
  });

  it('round-trips a minimal finding (no where, no body)', () => {
    const findings: Finding[] = [
      { id: '12-1', phaseId: 12, severity: 'nit', status: 'resolved', title: 'Typo in hint' },
    ];
    expect(parseFindings(serializeFindings(findings))).toEqual(findings);
  });

  it('preserves origin phase and index order across several entries', () => {
    const md = serializeFindings([
      { id: '155-1', phaseId: 155, severity: 'blocker', status: 'open', title: 'A' },
      { id: '155-2', phaseId: 155, severity: 'nit', status: 'resolved', title: 'B' },
    ]);
    const parsed = parseFindings(md);
    expect(parsed.map((f) => f.id)).toEqual(['155-1', '155-2']);
    expect(parsed.map((f) => f.phaseId)).toEqual([155, 155]);
  });

  it('strips a leading BOM and normalizes CRLF', () => {
    const md = '﻿# Adversarial findings\r\n\r\n## 9-1 · nit · open\r\nA title\r\n';
    expect(parseFindings(md)).toEqual([
      { id: '9-1', phaseId: 9, severity: 'nit', status: 'open', title: 'A title' },
    ]);
  });
});

describe('parseFindings — malformed input', () => {
  it('drops entries whose header id has no {phaseId}-{n} shape', () => {
    const md = '## bogus · nit · open\nA title\n\n## 5-1 · nit · open\nKept\n';
    expect(parseFindings(md).map((f) => f.id)).toEqual(['5-1']);
  });

  it('drops entries with no title', () => {
    const md = '## 5-1 · nit · open\n**Where:** a.ts:1\n\n## 5-2 · nit · open\nHas a title\n';
    expect(parseFindings(md).map((f) => f.id)).toEqual(['5-2']);
  });

  it('ignores non-entry lines (the header comment) and an empty store body', () => {
    expect(parseFindings('# Adversarial findings\n\n_(no findings)_\n')).toEqual([]);
    expect(parseFindings('')).toEqual([]);
  });
});

describe('addFinding / readPhaseFindings / listFindings — disk', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-findings-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('creates the directory and assigns sequential ids per phase', async () => {
    const first = await addFinding(cwd, 155, { severity: 'blocker', title: 'First' });
    expect(first).toEqual({ id: '155-1', path: findingsPath(cwd, 155) });

    const second = await addFinding(cwd, 155, {
      severity: 'nit',
      title: 'Second',
      where: 'src/x.ts:9',
      body: 'detail',
    });
    expect(second.id).toBe('155-2');

    const stored = await readPhaseFindings(cwd, 155);
    expect(stored).toEqual([
      { id: '155-1', phaseId: 155, severity: 'blocker', status: 'open', title: 'First' },
      {
        id: '155-2',
        phaseId: 155,
        severity: 'nit',
        status: 'open',
        where: 'src/x.ts:9',
        title: 'Second',
        body: 'detail',
      },
    ]);
  });

  it('keeps ids independent per phase file', async () => {
    await addFinding(cwd, 10, { severity: 'nit', title: 'a' });
    const other = await addFinding(cwd, 11, { severity: 'nit', title: 'b' });
    expect(other.id).toBe('11-1');
  });

  it('continues numbering after the highest existing index, not the count', async () => {
    // Pre-seed a file where 155-1 was resolved and removed by hand, leaving 155-2.
    await mkdir(join(cwd, FINDINGS_DIR), { recursive: true });
    await writeFile(
      findingsPath(cwd, 155),
      serializeFindings([
        { id: '155-2', phaseId: 155, severity: 'nit', status: 'open', title: 'kept' },
      ]),
      'utf8',
    );
    const next = await addFinding(cwd, 155, { severity: 'nit', title: 'new' });
    expect(next.id).toBe('155-3');
  });

  it('collapses newlines in the title so it cannot smuggle a second header line', async () => {
    await addFinding(cwd, 7, {
      severity: 'nit',
      title: 'line one\n## 7-9 · blocker · open\nline two',
    });
    const stored = await readPhaseFindings(cwd, 7);
    // The injected header line must not become its own entry.
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe('7-1');
    expect(stored[0]!.title).toBe('line one ## 7-9 · blocker · open line two');
  });

  it('readPhaseFindings returns an empty list for a missing file', async () => {
    expect(await readPhaseFindings(cwd, 999)).toEqual([]);
  });

  it('listFindings returns an empty list when the directory is missing', async () => {
    expect(await listFindings(cwd)).toEqual([]);
  });

  it('lists open findings across all phases by default, sorted by phase then index', async () => {
    await addFinding(cwd, 20, { severity: 'nit', title: 'twenty-one' });
    await addFinding(cwd, 10, { severity: 'blocker', title: 'ten-one' });
    await addFinding(cwd, 10, { severity: 'nit', title: 'ten-two' });

    const open = await listFindings(cwd);
    expect(open.map((f) => f.id)).toEqual(['10-1', '10-2', '20-1']);
  });

  it('hides resolved findings unless includeResolved is set', async () => {
    await addFinding(cwd, 10, { severity: 'nit', title: 'open one' });
    // Manually resolve a second one by rewriting the file.
    await writeFile(
      findingsPath(cwd, 10),
      serializeFindings([
        { id: '10-1', phaseId: 10, severity: 'nit', status: 'open', title: 'open one' },
        { id: '10-2', phaseId: 10, severity: 'nit', status: 'resolved', title: 'resolved one' },
      ]),
      'utf8',
    );

    expect((await listFindings(cwd)).map((f) => f.id)).toEqual(['10-1']);
    expect((await listFindings(cwd, { includeResolved: true })).map((f) => f.id)).toEqual([
      '10-1',
      '10-2',
    ]);
  });

  it('ignores files that are not phase-{id}.md', async () => {
    await addFinding(cwd, 10, { severity: 'nit', title: 'real' });
    await writeFile(join(cwd, FINDINGS_DIR, 'README.md'), '## 99-1 · nit · open\nfake\n', 'utf8');
    expect((await listFindings(cwd)).map((f) => f.id)).toEqual(['10-1']);
  });

  it('writes a human-readable header comment into the file', async () => {
    await addFinding(cwd, 10, { severity: 'nit', title: 'x' });
    const raw = await readFile(findingsPath(cwd, 10), 'utf8');
    expect(raw).toContain('# Adversarial findings');
    expect(raw).toContain('## 10-1 · nit · open');
  });
});
