import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RUN_DIR,
  RunReportParseError,
  parseRunReport,
  readRunReport,
  runReportPath,
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
