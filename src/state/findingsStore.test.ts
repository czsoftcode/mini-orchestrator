import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FINDINGS_DIR,
  type Finding,
  addFinding,
  findFindingById,
  findingsPath,
  isFindingSeverity,
  isFindingSource,
  listFindings,
  parseFindings,
  readPhaseFindings,
  reopenFinding,
  resolveFinding,
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

describe('isFindingSource', () => {
  it('accepts the known sources and rejects anything else', () => {
    expect(isFindingSource('adversarial')).toBe(true);
    expect(isFindingSource('verify')).toBe(true);
    expect(isFindingSource('project')).toBe(true);
    expect(isFindingSource('audit')).toBe(false);
    expect(isFindingSource('')).toBe(false);
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
        source: 'adversarial',
        where: 'src/foo.ts:42',
        title: 'Null cascades silently',
        body: 'When input is empty the parser returns undefined and the caller crashes later.',
      },
    ];
    expect(parseFindings(serializeFindings(findings))).toEqual(findings);
  });

  it('round-trips a minimal finding (no where, no body)', () => {
    const findings: Finding[] = [
      {
        id: '12-1',
        phaseId: 12,
        severity: 'nit',
        status: 'resolved',
        source: 'adversarial',
        title: 'Typo in hint',
      },
    ];
    expect(parseFindings(serializeFindings(findings))).toEqual(findings);
  });

  it('round-trips a verify-sourced finding', () => {
    const findings: Finding[] = [
      {
        id: '160-1',
        phaseId: 160,
        severity: 'should-know',
        status: 'open',
        source: 'verify',
        where: 'CLI output',
        title: 'Error message is unclear',
        body: 'The hint points to the wrong command.',
      },
    ];
    expect(parseFindings(serializeFindings(findings))).toEqual(findings);
  });

  it('round-trips a project-sourced finding', () => {
    const findings: Finding[] = [
      {
        id: '161-1',
        phaseId: 161,
        severity: 'blocker',
        status: 'open',
        source: 'project',
        where: 'src/state/store.ts:42',
        title: 'Regression across the reviewed range',
        body: 'Phase 158 changed the shape phase 154 still assumes.',
      },
    ];
    const md = serializeFindings(findings);
    // The widened union must survive parse → serialize untouched, and the
    // **Source:** line must carry the literal value (not get downgraded).
    expect(md).toContain('**Source:** project');
    expect(parseFindings(md)).toEqual(findings);
  });

  it('round-trips a finding with a reviewedAt SHA', () => {
    const findings: Finding[] = [
      {
        id: '156-1',
        phaseId: 156,
        severity: 'blocker',
        status: 'open',
        source: 'adversarial',
        where: 'src/foo.ts:42',
        reviewedAt: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
        title: 'Reviewed against a known baseline',
        body: 'Body after the metadata lines.',
      },
    ];
    expect(parseFindings(serializeFindings(findings))).toEqual(findings);
  });

  it('round-trips a finding with reviewedAt but no where', () => {
    const findings: Finding[] = [
      {
        id: '156-2',
        phaseId: 156,
        severity: 'nit',
        status: 'open',
        source: 'adversarial',
        reviewedAt: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        title: 'No location, only a baseline',
      },
    ];
    expect(parseFindings(serializeFindings(findings))).toEqual(findings);
  });

  it('parses an old file with no **Reviewed-at:** line identically (additive)', () => {
    // A pre-156 file: header + where + title + body, no reviewed-at metadata.
    const md =
      '# Adversarial findings\n\n## 9-1 · should-know · open\n' +
      '**Where:** src/a.ts:3\nA title\n\nA body.\n';
    expect(parseFindings(md)).toEqual([
      {
        id: '9-1',
        phaseId: 9,
        severity: 'should-know',
        status: 'open',
        source: 'adversarial',
        where: 'src/a.ts:3',
        title: 'A title',
        body: 'A body.',
      },
    ]);
  });

  it('defaults source to adversarial for an old file with no **Source:** line', () => {
    // A pre-160 file: no source metadata anywhere.
    const md = '# Adversarial findings\n\n## 9-1 · nit · open\nA title\n';
    expect(parseFindings(md)[0]?.source).toBe('adversarial');
  });

  it('preserves an unknown **Source:** value verbatim (160-2)', () => {
    // A value a future mini version might write (e.g. `security`). The typed
    // `source` still falls back to the default for logic, but the raw token is
    // kept so it round-trips on disk instead of being downgraded.
    const md = '## 9-1 · nit · open\n**Source:** security\nA title\n';
    const parsed = parseFindings(md);
    expect(parsed).toEqual([
      {
        id: '9-1',
        phaseId: 9,
        severity: 'nit',
        status: 'open',
        source: 'adversarial',
        rawSource: 'security',
        title: 'A title',
      },
    ]);
    // The crux of 160-2: a re-serialize must NOT rewrite `security` → `adversarial`.
    const round = serializeFindings(parsed);
    expect(round).toContain('**Source:** security');
    expect(round).not.toContain('**Source:** adversarial');
    expect(parseFindings(round)).toEqual(parsed);
  });

  it('does not set rawSource for a known **Source:** value', () => {
    const md = '## 9-1 · nit · open\n**Source:** verify\nA title\n';
    expect(parseFindings(md)[0]).not.toHaveProperty('rawSource');
  });

  it('preserves origin phase and index order across several entries', () => {
    const md = serializeFindings([
      { id: '155-1', phaseId: 155, severity: 'blocker', status: 'open', source: 'adversarial', title: 'A' },
      { id: '155-2', phaseId: 155, severity: 'nit', status: 'resolved', source: 'verify', title: 'B' },
    ]);
    const parsed = parseFindings(md);
    expect(parsed.map((f) => f.id)).toEqual(['155-1', '155-2']);
    expect(parsed.map((f) => f.phaseId)).toEqual([155, 155]);
    expect(parsed.map((f) => f.source)).toEqual(['adversarial', 'verify']);
  });

  it('strips a leading BOM and normalizes CRLF', () => {
    const md = '﻿# Adversarial findings\r\n\r\n## 9-1 · nit · open\r\nA title\r\n';
    expect(parseFindings(md)).toEqual([
      { id: '9-1', phaseId: 9, severity: 'nit', status: 'open', source: 'adversarial', title: 'A title' },
    ]);
  });

  it('round-trips a project finding with a reviewed range', () => {
    const findings: Finding[] = [
      {
        id: '178-1',
        phaseId: 178,
        severity: 'should-know',
        status: 'open',
        source: 'project',
        where: 'src/cli.ts:403',
        reviewedAt: '0c27cc6c5aa7889af8fae83a06f56c28a41b1d64',
        range: '172-178',
        title: 'Regression spanning the range',
        body: 'Phase 175 broke what 172 set up.',
      },
    ];
    const md = serializeFindings(findings);
    // The Range line sits after Source in the canonical order, before the title.
    expect(md).toMatch(/\*\*Source:\*\* project\n\*\*Range:\*\* 172-178\nRegression/);
    expect(parseFindings(md)).toEqual(findings);
  });

  it('omits the **Range:** line entirely when there is no range (additive)', () => {
    const md = serializeFindings([
      { id: '9-1', phaseId: 9, severity: 'nit', status: 'open', source: 'adversarial', title: 'No range' },
    ]);
    expect(md).not.toContain('Range');
    expect(parseFindings(md)[0]).not.toHaveProperty('range');
  });

  it('parses an old file with no **Range:** line identically (back-compat)', () => {
    const md =
      '# Review findings\n\n## 9-1 · should-know · open\n' +
      '**Where:** src/a.ts:3\n**Source:** project\nA title\n\nA body.\n';
    expect(parseFindings(md)).toEqual([
      {
        id: '9-1',
        phaseId: 9,
        severity: 'should-know',
        status: 'open',
        source: 'project',
        where: 'src/a.ts:3',
        title: 'A title',
        body: 'A body.',
      },
    ]);
  });

  it('parses metadata regardless of order — a reordered Source/Range/Where block', () => {
    // Hand-edited file with the metadata lines in a non-canonical order. The old
    // position-locked parser swallowed the title here; the order-independent
    // parser must recover every field and keep the real title.
    const md =
      '## 5-1 · blocker · open\n' +
      '**Range:** 5-7\n**Source:** project\n**Reviewed-at:** deadbeef\n**Where:** src/x.ts:9\n' +
      'The actual title\n\nThe body.\n';
    expect(parseFindings(md)).toEqual([
      {
        id: '5-1',
        phaseId: 5,
        severity: 'blocker',
        status: 'open',
        source: 'project',
        where: 'src/x.ts:9',
        reviewedAt: 'deadbeef',
        range: '5-7',
        title: 'The actual title',
        body: 'The body.',
      },
    ]);
  });

  it('round-trips a finding with a **Reason:** line (after Source, before title)', () => {
    const findings: Finding[] = [
      {
        id: '155-1',
        phaseId: 155,
        severity: 'nit',
        status: 'resolved',
        source: 'adversarial',
        title: 'A dismissed nit',
        reason: 'wont fix — by design',
      },
    ];
    const md = serializeFindings(findings);
    expect(md).toMatch(/\*\*Source:\*\* adversarial\n\*\*Reason:\*\* wont fix — by design\nA dismissed nit/);
    expect(parseFindings(md)).toEqual(findings);
  });

  it('parses a **Reason:** line regardless of order', () => {
    const md =
      '## 5-1 · nit · resolved\n' +
      '**Reason:** closed by 190\n**Where:** src/x.ts:9\n**Source:** verify\n' +
      'The actual title\n';
    expect(parseFindings(md)).toEqual([
      {
        id: '5-1',
        phaseId: 5,
        severity: 'nit',
        status: 'resolved',
        source: 'verify',
        where: 'src/x.ts:9',
        reason: 'closed by 190',
        title: 'The actual title',
      },
    ]);
  });

  it('omits the **Reason:** line when there is no reason (old files round-trip)', () => {
    const md = serializeFindings([
      { id: '9-1', phaseId: 9, severity: 'nit', status: 'resolved', source: 'adversarial', title: 'No reason' },
    ]);
    expect(md).not.toContain('Reason');
    expect(parseFindings(md)[0]).not.toHaveProperty('reason');
  });

  it('treats a repeated metadata line as the title (each field consumed once)', () => {
    // A second **Range:** line is not metadata anymore — the first content line
    // becomes the title, so a stray duplicate cannot silently eat the headline.
    const md = '## 5-1 · nit · open\n**Range:** 5-7\n**Range:** 8-9\nReal title\n';
    const parsed = parseFindings(md);
    expect(parsed[0]?.range).toBe('5-7');
    expect(parsed[0]?.title).toBe('**Range:** 8-9');
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
      { id: '155-1', phaseId: 155, severity: 'blocker', status: 'open', source: 'adversarial', title: 'First' },
      {
        id: '155-2',
        phaseId: 155,
        severity: 'nit',
        status: 'open',
        source: 'adversarial',
        where: 'src/x.ts:9',
        title: 'Second',
        body: 'detail',
      },
    ]);
  });

  it('defaults source to adversarial when none is passed', async () => {
    await addFinding(cwd, 155, { severity: 'blocker', title: 'no source flag' });
    expect((await readPhaseFindings(cwd, 155))[0]?.source).toBe('adversarial');
  });

  it('persists an explicit verify source passed to addFinding', async () => {
    await addFinding(cwd, 160, { severity: 'nit', title: 'from verify', source: 'verify' });
    const stored = await readPhaseFindings(cwd, 160);
    expect(stored[0]?.source).toBe('verify');
    const raw = await readFile(findingsPath(cwd, 160), 'utf8');
    expect(raw).toContain('**Source:** verify');
  });

  it('persists a reviewedAt SHA passed to addFinding', async () => {
    const sha = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';
    await addFinding(cwd, 156, { severity: 'should-know', title: 'has a baseline', reviewedAt: sha });
    const stored = await readPhaseFindings(cwd, 156);
    expect(stored).toEqual([
      {
        id: '156-1',
        phaseId: 156,
        severity: 'should-know',
        status: 'open',
        source: 'adversarial',
        reviewedAt: sha,
        title: 'has a baseline',
      },
    ]);
  });

  it('omits reviewedAt when none is passed (additive)', async () => {
    await addFinding(cwd, 156, { severity: 'nit', title: 'no baseline' });
    const stored = await readPhaseFindings(cwd, 156);
    expect(stored[0]).not.toHaveProperty('reviewedAt');
    const raw = await readFile(findingsPath(cwd, 156), 'utf8');
    expect(raw).not.toContain('Reviewed-at');
  });

  it('persists a reviewed range passed to addFinding', async () => {
    await addFinding(cwd, 178, {
      severity: 'should-know',
      title: 'range finding',
      source: 'project',
      range: '172-178',
    });
    const stored = await readPhaseFindings(cwd, 178);
    expect(stored[0]?.range).toBe('172-178');
    const raw = await readFile(findingsPath(cwd, 178), 'utf8');
    expect(raw).toContain('**Range:** 172-178');
  });

  it('omits range when none is passed (additive)', async () => {
    await addFinding(cwd, 156, { severity: 'nit', title: 'no range' });
    const stored = await readPhaseFindings(cwd, 156);
    expect(stored[0]).not.toHaveProperty('range');
    const raw = await readFile(findingsPath(cwd, 156), 'utf8');
    expect(raw).not.toContain('Range');
  });

  it('collapses newlines in the range so it stays a single metadata line', async () => {
    await addFinding(cwd, 7, { severity: 'nit', title: 'x', range: '5-\n7' });
    const stored = await readPhaseFindings(cwd, 7);
    expect(stored[0]?.range).toBe('5- 7');
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
        { id: '155-2', phaseId: 155, severity: 'nit', status: 'open', source: 'adversarial', title: 'kept' },
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
        { id: '10-1', phaseId: 10, severity: 'nit', status: 'open', source: 'adversarial', title: 'open one' },
        { id: '10-2', phaseId: 10, severity: 'nit', status: 'resolved', source: 'adversarial', title: 'resolved one' },
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
    expect(raw).toContain('# Review findings');
    expect(raw).toContain('## 10-1 · nit · open');
  });

  it('findFindingById returns the finding for an existing id (open or resolved)', async () => {
    await addFinding(cwd, 155, { severity: 'blocker', title: 'first', where: 'src/x.ts:1' });
    // Resolve a second one by rewriting the file, to prove resolved ids are included.
    await writeFile(
      findingsPath(cwd, 155),
      serializeFindings([
        { id: '155-1', phaseId: 155, severity: 'blocker', status: 'open', source: 'adversarial', where: 'src/x.ts:1', title: 'first' },
        { id: '155-2', phaseId: 155, severity: 'nit', status: 'resolved', source: 'adversarial', title: 'second' },
      ]),
      'utf8',
    );

    expect(await findFindingById(cwd, '155-1')).toEqual({
      id: '155-1',
      phaseId: 155,
      severity: 'blocker',
      status: 'open',
      source: 'adversarial',
      where: 'src/x.ts:1',
      title: 'first',
    });
    expect((await findFindingById(cwd, '155-2'))?.status).toBe('resolved');
  });

  it('findFindingById returns null for a non-existent id whose file exists', async () => {
    await addFinding(cwd, 155, { severity: 'nit', title: 'only one' });
    expect(await findFindingById(cwd, '155-9')).toBeNull();
  });

  it('findFindingById returns null for a missing phase file', async () => {
    expect(await findFindingById(cwd, '999-1')).toBeNull();
  });

  it('findFindingById returns null for a malformed id shape (never throws)', async () => {
    expect(await findFindingById(cwd, 'bogus')).toBeNull();
    expect(await findFindingById(cwd, '155')).toBeNull();
    expect(await findFindingById(cwd, '')).toBeNull();
  });
});

describe('resolveFinding / reopenFinding — status flip', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-findings-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('resolveFinding flips open → resolved and reports the change', async () => {
    await addFinding(cwd, 155, { severity: 'blocker', title: 'first' });
    expect(await resolveFinding(cwd, '155-1')).toBe(true);
    expect((await findFindingById(cwd, '155-1'))?.status).toBe('resolved');
  });

  it('reopenFinding flips resolved → open and reports the change', async () => {
    await addFinding(cwd, 155, { severity: 'blocker', title: 'first' });
    await resolveFinding(cwd, '155-1');
    expect(await reopenFinding(cwd, '155-1')).toBe(true);
    expect((await findFindingById(cwd, '155-1'))?.status).toBe('open');
  });

  it('preserves where / reviewedAt / body and other entries when flipping', async () => {
    const sha = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';
    await addFinding(cwd, 155, {
      severity: 'should-know',
      title: 'first',
      where: 'src/x.ts:9',
      reviewedAt: sha,
      body: 'what breaks',
    });
    await addFinding(cwd, 155, { severity: 'nit', title: 'second' });

    expect(await resolveFinding(cwd, '155-1')).toBe(true);

    const stored = await readPhaseFindings(cwd, 155);
    expect(stored).toEqual([
      {
        id: '155-1',
        phaseId: 155,
        severity: 'should-know',
        status: 'resolved',
        source: 'adversarial',
        where: 'src/x.ts:9',
        reviewedAt: sha,
        title: 'first',
        body: 'what breaks',
      },
      { id: '155-2', phaseId: 155, severity: 'nit', status: 'open', source: 'adversarial', title: 'second' },
    ]);
  });

  it('is a no-op when the status already matches the target', async () => {
    await addFinding(cwd, 155, { severity: 'nit', title: 'first' });
    // already open
    expect(await reopenFinding(cwd, '155-1')).toBe(false);
    await resolveFinding(cwd, '155-1');
    // already resolved
    expect(await resolveFinding(cwd, '155-1')).toBe(false);
  });

  it('records a --reason on the open → resolved flip', async () => {
    await addFinding(cwd, 155, { severity: 'nit', title: 'first' });
    expect(await resolveFinding(cwd, '155-1', 'fixed in phase 190')).toBe(true);
    expect((await findFindingById(cwd, '155-1'))?.reason).toBe('fixed in phase 190');
    // The reason round-trips through the file as a **Reason:** line.
    expect(await readFile(findingsPath(cwd, 155), 'utf8')).toContain('**Reason:** fixed in phase 190');
  });

  it('clears the reason when a resolved finding is reopened', async () => {
    await addFinding(cwd, 155, { severity: 'nit', title: 'first' });
    await resolveFinding(cwd, '155-1', 'closed for now');
    expect(await reopenFinding(cwd, '155-1')).toBe(true);
    expect((await findFindingById(cwd, '155-1'))).not.toHaveProperty('reason');
    expect(await readFile(findingsPath(cwd, 155), 'utf8')).not.toContain('**Reason:**');
  });

  it('does not overwrite an existing reason when resolving an already-resolved finding', async () => {
    await addFinding(cwd, 155, { severity: 'nit', title: 'first' });
    await resolveFinding(cwd, '155-1', 'first reason');
    // Already resolved → no-op; the second reason must not clobber the first.
    expect(await resolveFinding(cwd, '155-1', 'second reason')).toBe(false);
    expect((await findFindingById(cwd, '155-1'))?.reason).toBe('first reason');
  });

  it('resolving without a reason leaves the reason absent', async () => {
    await addFinding(cwd, 155, { severity: 'nit', title: 'first' });
    expect(await resolveFinding(cwd, '155-1')).toBe(true);
    expect(await findFindingById(cwd, '155-1')).not.toHaveProperty('reason');
  });

  it('is a no-op (no throw) for an id not present in an existing file', async () => {
    await addFinding(cwd, 155, { severity: 'nit', title: 'only one' });
    expect(await resolveFinding(cwd, '155-9')).toBe(false);
  });

  it('is a no-op (no throw) for a missing phase file', async () => {
    expect(await resolveFinding(cwd, '999-1')).toBe(false);
    expect(await reopenFinding(cwd, '999-1')).toBe(false);
  });

  it('is a no-op (no throw) for a malformed id shape', async () => {
    expect(await resolveFinding(cwd, 'bogus')).toBe(false);
    expect(await resolveFinding(cwd, '155')).toBe(false);
    expect(await reopenFinding(cwd, '')).toBe(false);
  });
});
