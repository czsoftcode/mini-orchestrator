import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RUN_DIR,
  RunReportParseError,
  parseRunReport,
  readRunReport,
  readRunReportSummary,
  runReportPath,
  stripFindingsSections,
  summarizeRunReportText,
} from './runReport.js';

describe('parseRunReport — happy path', () => {
  it('parses a minimal report with quoted titles and trims the body', () => {
    const text = `---
phase: 9
verdict: done
steps:
  - title: "Krok A"
    status: done
  - title: "Krok B"
    status: skipped
---

# Fáze 9 — report

Volný text vespod.
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 9,
      expectedStepTitles: ['Krok A', 'Krok B'],
    });

    expect(report.phase).toBe(9);
    expect(report.verdict).toBe('done');
    expect(report.steps).toEqual([
      { title: 'Krok A', status: 'done' },
      { title: 'Krok B', status: 'skipped' },
    ]);
    expect(report.body).toBe('# Fáze 9 — report\n\nVolný text vespod.');
  });

  it('returns body=undefined when there is nothing after the YAML block', () => {
    const text = `---
phase: 1
verdict: partial
steps:
  - title: "Jen krok"
    status: todo
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 1,
      expectedStepTitles: ['Jen krok'],
    });

    expect(report.body).toBeUndefined();
    expect(report.steps[0]).toEqual({ title: 'Jen krok', status: 'todo' });
  });

  it('accepts an inline empty steps list', () => {
    const text = `---
phase: 2
verdict: done
steps: []
---

Text bez kroků.
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 2,
      expectedStepTitles: [],
    });

    expect(report.steps).toEqual([]);
    expect(report.body).toBe('Text bez kroků.');
  });

  it('accepts an indented [] marker for an empty steps list', () => {
    const text = `---
phase: 3
verdict: done
steps:
  []
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 3,
      expectedStepTitles: [],
    });

    expect(report.steps).toEqual([]);
  });

  it('accepts unquoted titles (no quotes, no special chars)', () => {
    const text = `---
phase: 7
verdict: blocked
steps:
  - title: Krok bez uvozovek
    status: blocked
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 7,
      expectedStepTitles: ['Krok bez uvozovek'],
    });

    expect(report.steps[0]?.title).toBe('Krok bez uvozovek');
    expect(report.steps[0]?.status).toBe('blocked');
  });

  it('preserves escapes in double-quoted titles', () => {
    const text = `---
phase: 4
verdict: done
steps:
  - title: "Krok s \\"uvozovkami\\" a \\\\ zpětným lomítkem"
    status: done
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 4,
      expectedStepTitles: ['Krok s "uvozovkami" a \\ zpětným lomítkem'],
    });

    expect(report.steps[0]?.title).toBe('Krok s "uvozovkami" a \\ zpětným lomítkem');
  });

  it('normalizes CRLF line endings', () => {
    const text = [
      '---',
      'phase: 5',
      'verdict: done',
      'steps:',
      '  - title: "Jeden"',
      '    status: done',
      '---',
      '',
      'Body',
    ].join('\r\n');

    const report = parseRunReport(text, {
      expectedPhaseId: 5,
      expectedStepTitles: ['Jeden'],
    });

    expect(report.steps).toEqual([{ title: 'Jeden', status: 'done' }]);
    expect(report.body).toBe('Body');
  });

  it('strips a UTF-8 BOM at the start of the file', () => {
    const text = `﻿---
phase: 6
verdict: done
steps: []
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 6,
      expectedStepTitles: [],
    });

    expect(report.phase).toBe(6);
  });

  it('ignores `# komentář` after a space in YAML', () => {
    const text = `---
phase: 8  # ID fáze
verdict: done
steps:
  - title: "Krok"  # první
    status: done
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 8,
      expectedStepTitles: ['Krok'],
    });

    expect(report.phase).toBe(8);
    expect(report.steps[0]?.title).toBe('Krok');
  });

  it('does NOT treat `#` inside a quoted string as a comment', () => {
    const text = `---
phase: 9
verdict: done
steps:
  - title: "Krok #1 v pořadí"
    status: done
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 9,
      expectedStepTitles: ['Krok #1 v pořadí'],
    });

    expect(report.steps[0]?.title).toBe('Krok #1 v pořadí');
  });
});

describe('parseRunReport — strukturální chyby', () => {
  it('hází, když chybí YAML front matter úplně', () => {
    expect(() =>
      parseRunReport('Nějaký text bez YAML.\n', {
        expectedPhaseId: 1,
        expectedStepTitles: [],
      }),
    ).toThrow(RunReportParseError);
  });

  it('hází, když chybí uzavírací `---`', () => {
    const text = `---
phase: 1
verdict: done
steps: []

# zapomněl jsem zavřít
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(RunReportParseError);
  });

  it('hází na tabulátor v YAML odsazení', () => {
    const text = '---\nphase: 1\nverdict: done\nsteps:\n\t- title: "X"\n\t  status: done\n---\n';

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: ['X'] }),
    ).toThrow(/tabulátor/);
  });

  it('hází na nečitelnou řádku YAML', () => {
    const text = `---
phase: 1
tohle neni klic
verdict: done
steps: []
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(/Nečitelná/);
  });
});

describe('parseRunReport — validace polí', () => {
  it('hází, když `phase` chybí', () => {
    const text = `---
verdict: done
steps: []
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(/phase/);
  });

  it('hází, když `phase` není číslo', () => {
    const text = `---
phase: "nine"
verdict: done
steps: []
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(/phase/);
  });

  it('hází, když `phase` nesedí s očekávaným ID', () => {
    const text = `---
phase: 7
verdict: done
steps: []
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 9, expectedStepTitles: [] }),
    ).toThrow(/fázi 7.*je 9/);
  });

  it('hází, když `verdict` je neznámý', () => {
    const text = `---
phase: 1
verdict: maybe
steps: []
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(/verdict/);
  });

  it('hází, když `steps` není pole', () => {
    const text = `---
phase: 1
verdict: done
steps: hotovo
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(/steps/);
  });

  it('hází na neznámý status kroku', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: "X"
    status: hotovo
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: ['X'] }),
    ).toThrow(/status.*X/);
  });

  it('hází na prázdný title kroku', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: ""
    status: done
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [''] }),
    ).toThrow(/title/);
  });
});

describe('parseRunReport — validace názvů kroků vůči stavu', () => {
  it('hází, když report obsahuje neznámý krok', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: "Krok A"
    status: done
  - title: "Vymyšlený krok"
    status: done
---
`;

    expect(() =>
      parseRunReport(text, {
        expectedPhaseId: 1,
        expectedStepTitles: ['Krok A', 'Krok B'],
      }),
    ).toThrow(/neexistují.*"Vymyšlený krok"/);
  });

  it('hází, když report neuvádí status pro existující krok', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: "Krok A"
    status: done
---
`;

    expect(() =>
      parseRunReport(text, {
        expectedPhaseId: 1,
        expectedStepTitles: ['Krok A', 'Krok B'],
      }),
    ).toThrow(/neuvádí.*"Krok B"/);
  });

  it('hází, když report obsahuje duplicitní názvy kroků', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: "Krok A"
    status: done
  - title: "Krok A"
    status: skipped
---
`;

    expect(() =>
      parseRunReport(text, {
        expectedPhaseId: 1,
        expectedStepTitles: ['Krok A'],
      }),
    ).toThrow(/duplicitní/);
  });

  it('rozlišuje názvy kroků case-sensitivně (strict match)', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: "krok a"
    status: done
---
`;

    expect(() =>
      parseRunReport(text, {
        expectedPhaseId: 1,
        expectedStepTitles: ['Krok A'],
      }),
    ).toThrow(/neexistují/);
  });

  it('je citlivý na okrajové mezery v názvu (strict match)', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: " Krok A "
    status: done
---
`;

    expect(() =>
      parseRunReport(text, {
        expectedPhaseId: 1,
        expectedStepTitles: ['Krok A'],
      }),
    ).toThrow(/neexistují/);
  });
});

describe('parseRunReport — pole verify', () => {
  it('vrací prázdný seznam, když pole verify chybí (zpětná kompatibilita)', () => {
    const text = `---
phase: 1
verdict: done
steps:
  - title: "Krok A"
    status: done
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 1,
      expectedStepTitles: ['Krok A'],
    });

    expect(report.verify).toEqual([]);
  });

  it('naparsuje verify s title i detail', () => {
    const text = `---
phase: 2
verdict: done
steps: []
verify:
  - title: Ověř tlačítko na mobilu
    detail: Testováno jen curl, vizuál neznámý
  - title: Zkontroluj UX flow přihlášení
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 2,
      expectedStepTitles: [],
    });

    expect(report.verify).toEqual([
      { title: 'Ověř tlačítko na mobilu', detail: 'Testováno jen curl, vizuál neznámý' },
      { title: 'Zkontroluj UX flow přihlášení' },
    ]);
  });

  it('akceptuje prázdný seznam verify ([])', () => {
    const text = `---
phase: 3
verdict: done
steps: []
verify: []
---
`;

    const report = parseRunReport(text, {
      expectedPhaseId: 3,
      expectedStepTitles: [],
    });

    expect(report.verify).toEqual([]);
  });

  it('hází, když verify není seznam', () => {
    const text = `---
phase: 1
verdict: done
steps: []
verify: hotovo
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(/verify/);
  });

  it('hází, když verify položka nemá title', () => {
    const text = `---
phase: 1
verdict: done
steps: []
verify:
  - detail: chybí mi title
---
`;

    expect(() =>
      parseRunReport(text, { expectedPhaseId: 1, expectedStepTitles: [] }),
    ).toThrow(/title/);
  });
});

describe('readRunReport — práce se souborem', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-run-report-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('vrátí null, když soubor neexistuje', async () => {
    const r = await readRunReport(cwd, { expectedPhaseId: 1, expectedStepTitles: [] });
    expect(r).toBeNull();
  });

  it('přečte a naparsuje existující report', async () => {
    await mkdir(join(cwd, RUN_DIR), { recursive: true });
    const path = runReportPath(cwd, 4);
    await writeFile(
      path,
      `---
phase: 4
verdict: done
steps:
  - title: "Hotovo"
    status: done
---

ok
`,
      'utf-8',
    );

    const r = await readRunReport(cwd, {
      expectedPhaseId: 4,
      expectedStepTitles: ['Hotovo'],
    });

    expect(r).not.toBeNull();
    expect(r?.phase).toBe(4);
    expect(r?.steps).toEqual([{ title: 'Hotovo', status: 'done' }]);
    expect(r?.body).toBe('ok');
  });

  it('propaguje RunReportParseError, když je report poškozený', async () => {
    await mkdir(join(cwd, RUN_DIR), { recursive: true });
    await writeFile(runReportPath(cwd, 4), 'bez YAML hlavičky\n', 'utf-8');

    await expect(
      readRunReport(cwd, { expectedPhaseId: 4, expectedStepTitles: [] }),
    ).rejects.toBeInstanceOf(RunReportParseError);
  });
});

describe('summarizeRunReportText — tolerantní souhrn pro status', () => {
  it('vytáhne verdikt a verify body bez validace kroků', () => {
    const s = summarizeRunReportText(`---
phase: 7
verdict: partial
steps:
  - title: "Cokoli"
    status: todo
verify:
  - title: "Ověř UI"
    detail: "vizuální"
  - title: "Ověř flow"
---

text
`);
    expect(s.unparseable).toBe(false);
    expect(s.verdict).toBe('partial');
    expect(s.verify).toEqual([
      { title: 'Ověř UI', detail: 'vizuální' },
      { title: 'Ověř flow' },
    ]);
    expect(s.body).toBe('text');
  });

  it('verdict je null u neznámé hodnoty, ale parse nepadne', () => {
    const s = summarizeRunReportText(`---
phase: 1
verdict: nesmysl
steps: []
---
`);
    expect(s.unparseable).toBe(false);
    expect(s.verdict).toBeNull();
    expect(s.verify).toEqual([]);
    expect(s.body).toBeUndefined();
  });

  it('označí report bez YAML hlavičky jako unparseable', () => {
    const s = summarizeRunReportText('jen volný text bez hlavičky\n');
    expect(s.unparseable).toBe(true);
    expect(s.verdict).toBeNull();
    expect(s.verify).toEqual([]);
  });

  it('chybné verify pole nezhatí celý souhrn (verdikt zůstane)', () => {
    const s = summarizeRunReportText(`---
phase: 1
verdict: done
verify: "tohle není seznam"
---
`);
    expect(s.unparseable).toBe(false);
    expect(s.verdict).toBe('done');
    expect(s.verify).toEqual([]);
  });
});

describe('readRunReportSummary — práce se souborem', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-run-summary-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('vrátí null, když report neexistuje', async () => {
    expect(await readRunReportSummary(cwd, 1)).toBeNull();
  });

  it('přečte a tolerantně shrne existující report', async () => {
    await mkdir(join(cwd, RUN_DIR), { recursive: true });
    await writeFile(
      runReportPath(cwd, 3),
      `---
phase: 3
verdict: blocked
steps: []
---
`,
      'utf-8',
    );
    const s = await readRunReportSummary(cwd, 3);
    expect(s?.verdict).toBe('blocked');
    expect(s?.unparseable).toBe(false);
  });
});

describe('stripFindingsSections', () => {
  it('removes a findings section in the middle, keeps surrounding text', () => {
    const body = [
      'Implementation notes.',
      '',
      '## Adversarial findings',
      '- 5-1 something is wrong',
      '',
      '## Next steps',
      'Carry on.',
    ].join('\n');
    const out = stripFindingsSections(body);
    expect(out).toContain('Implementation notes.');
    expect(out).toContain('## Next steps');
    expect(out).toContain('Carry on.');
    expect(out).not.toContain('Adversarial findings');
    expect(out).not.toContain('5-1 something is wrong');
  });

  it('removes a findings section at the end of the body (nothing after it)', () => {
    const body = ['Notes.', '', '## Verify findings', '- 5-2 looks off'].join('\n');
    const out = stripFindingsSections(body);
    expect(out).toBe('Notes.');
  });

  it('removes two consecutive findings sections', () => {
    const body = [
      'Lead.',
      '',
      '## Adversarial findings',
      '- a',
      '',
      '## Verify findings',
      '- b',
    ].join('\n');
    const out = stripFindingsSections(body);
    expect(out).toBe('Lead.');
  });

  it('leaves a body without any findings section unchanged', () => {
    const body = ['# Report', '', 'Some text.', '', '## Notes', 'More.'].join('\n');
    expect(stripFindingsSections(body)).toBe(body);
  });

  it('stops a findings section at the next top-level (#) heading', () => {
    const body = [
      '## Adversarial findings',
      '- gone',
      '# Implementation report',
      'kept',
    ].join('\n');
    const out = stripFindingsSections(body);
    expect(out).not.toContain('gone');
    expect(out).toContain('# Implementation report');
    expect(out).toContain('kept');
  });

  it('returns an empty string for an empty or whitespace-only body', () => {
    expect(stripFindingsSections('')).toBe('');
    expect(stripFindingsSections('   \n\n  ')).toBe('');
  });

  it('handles CRLF line endings and a leading BOM', () => {
    const body = '﻿Notes.\r\n\r\n## Verify findings\r\n- x\r\n';
    expect(stripFindingsSections(body)).toBe('Notes.');
  });

  it('does NOT remove a same-named heading that is not exactly the findings title', () => {
    const body = [
      '## Adversarial findings and lessons',
      'This is real prose, not a stale section.',
    ].join('\n');
    // The title differs from the exact 'adversarial findings', so it stays.
    expect(stripFindingsSections(body)).toBe(body);
  });

  it('matches the heading case-insensitively', () => {
    const body = ['## ADVERSARIAL FINDINGS', '- gone', '', '## Keep', 'kept'].join('\n');
    const out = stripFindingsSections(body);
    expect(out).not.toContain('gone');
    expect(out).toContain('## Keep');
  });

  it('keeps a findings-like heading inside a fenced code block (and prose after it)', () => {
    // A `do` report documenting the findings format must survive intact: the
    // heading is example text inside a fence, not a real stale section.
    const body = [
      '## What was done',
      'Example:',
      '```md',
      '## Adversarial findings',
      '- x',
      '```',
      'Done notes.',
    ].join('\n');
    const out = stripFindingsSections(body);
    expect(out).toContain('## Adversarial findings');
    expect(out).toContain('- x');
    expect(out).toContain('Done notes.');
  });

  it('removes a stale section that contains a fenced block with a heading line', () => {
    // The fenced '# Still inside' is literal text, so it must NOT end the stale
    // section early — the whole section, fence and all, is dropped.
    const body = [
      'Lead.',
      '',
      '## Adversarial findings',
      '- 5-1 bug',
      '```',
      '# Still inside',
      '```',
      'tail of stale section',
      '',
      '## Keep',
      'kept',
    ].join('\n');
    const out = stripFindingsSections(body);
    expect(out).not.toContain('5-1 bug');
    expect(out).not.toContain('Still inside');
    expect(out).not.toContain('tail of stale section');
    expect(out).toContain('Lead.');
    expect(out).toContain('## Keep');
    expect(out).toContain('kept');
  });
});
