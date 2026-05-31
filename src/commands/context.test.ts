import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { context, isContextCommand, CONTEXT_COMMANDS } from './context.js';
import { save } from '../state/store.js';
import { writeProject } from '../state/store.js';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import type { Phase, ProjectState } from '../state/types.js';

let cwd: string;
let out: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let writeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-context-'));
  out = '';
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(cwd);
  writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    out += String(chunk);
    return true;
  });
  process.exitCode = undefined;
});

afterEach(async () => {
  cwdSpy.mockRestore();
  writeSpy.mockRestore();
  process.exitCode = undefined;
  await rm(cwd, { recursive: true, force: true });
});

function makeState(phases: Phase[], currentPhaseId: number | null): ProjectState {
  return { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId, phases };
}

async function setupProject(phases: Phase[], currentPhaseId: number | null): Promise<void> {
  await writeProject('# Demo\n\n## Co stavím\nNěco.', cwd);
  await save(makeState(phases, currentPhaseId), cwd);
}

describe('isContextCommand', () => {
  it('zná příkazy cyklu i verify', () => {
    expect(CONTEXT_COMMANDS).toEqual(['next', 'discuss', 'plan', 'do', 'done', 'verify']);
    expect(isContextCommand('plan')).toBe(true);
    expect(isContextCommand('verify')).toBe(true);
    expect(isContextCommand('auto')).toBe(false);
  });
});

describe('context', () => {
  it('neznámý pod-příkaz → exit code 1, nic na stdout', async () => {
    await setupProject([], null);
    await context('auto');
    expect(process.exitCode).toBe(1);
    expect(out).toBe('');
  });

  it('bez projektu → exit code 1', async () => {
    await context('next');
    expect(process.exitCode).toBe(1);
  });

  it('next vypíše prompt s mini next --apply', async () => {
    await setupProject([], null);
    await context('next');
    expect(process.exitCode).toBeUndefined();
    expect(out).toContain('mini next --apply');
    expect(out).toContain('krok **next**');
  });

  it('next bere extra argumenty jako nápad uživatele', async () => {
    await setupProject([], null);
    await context('next', ['přidej', 'CSV', 'export']);
    expect(out).toContain('přidej CSV export');
    expect(out).toContain('Nápad uživatele');
  });

  it('plan bez aktuální fáze → exit code 1', async () => {
    await setupProject([], null);
    await context('plan');
    expect(process.exitCode).toBe(1);
    expect(out).toBe('');
  });

  it('plan s aktuální fází vypíše prompt s mini plan --apply', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'proposed' }], 1);
    await context('plan');
    expect(out).toContain('mini plan --apply');
    expect(out).toContain('Fáze 1: Fáze A');
  });

  it('discuss vypíše diskusní prompt', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'proposed' }], 1);
    await context('discuss');
    expect(out).toContain('diskusní session');
    expect(out).toContain('.mini/discuss/phase-001.md');
  });

  it('do vypíše auto-prompt s instrukcí zapsat report', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1);
    await context('do');
    expect(out).toContain('.mini/run/phase-001.md');
    expect(out).toContain('Report at the end of the session');
  });

  it('do bez poznámek z diskuse blok poznámek vynechá', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1);
    await context('do');
    expect(out).not.toContain('# Poznámky k fázi (z diskuse)');
  });

  it('do s existujícími poznámkami → odkaz + read-once, ne inline text', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'planned', steps: [{ title: 's', status: 'todo' }] }], 1);
    await mkdir(join(cwd, '.mini', 'discuss'), { recursive: true });
    await writeFile(
      join(cwd, '.mini', 'discuss', 'phase-001.md'),
      '# Fáze 1\n\n## Záměr\nTAJNY INLINE TEXT NESMI BYT V PROMPTU',
      'utf-8',
    );
    await context('do');
    // Reference mód: odkaz na soubor + read-once instrukce, ale ne plný text.
    expect(out).toContain('# Phase notes (from discussion)');
    expect(out).toContain('.mini/discuss/phase-001.md');
    expect(out).toContain('Read');
    expect(out).not.toContain('TAJNY INLINE TEXT NESMI BYT V PROMPTU');
  });

  it('do projekt → odkaz na .mini/project.md + read-once, ne inline text projektu', async () => {
    await setupProject(
      [{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'planned', steps: [{ title: 's', status: 'todo' }] }],
      1,
    );
    await context('do');
    // Reference mód projektu: odkaz na soubor místo inlinovaného obsahu project.md.
    expect(out).toContain('.mini/project.md');
    expect(out).toContain('Read');
    // Inline tělo project.md (viz setupProject) se nesmí objevit.
    expect(out).not.toContain('Něco.');
  });

  it('done bez reportu pošle na /mini:do', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'doing', steps: [{ title: 's', status: 'doing' }] }], 1);
    await context('done');
    expect(out).toContain('/mini:do');
  });

  it('done s reportem vypíše shrnutí a mini done --apply', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }] }], 1);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      ['---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "krok 1"', '    status: done', '---', '', 'všechno klape'].join('\n'),
      'utf-8',
    );
    await context('done');
    expect(out).toContain('mini done --apply');
    expect(out).toContain('všechno klape');
  });

  it('done s verify body v reportu vyžaduje --accept-verify', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }] }], 1);
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "krok 1"', '    status: done',
        'verify:', '  - title: "mrkni na UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );
    await context('done');
    expect(out).toContain('--accept-verify');
    expect(out).toContain('mrkni na UI');
  });

  it('verify bez aktuální i uzavřené fáze → exit code 1', async () => {
    await setupProject([{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'proposed' }], null);
    await context('verify');
    expect(process.exitCode).toBe(1);
    expect(out).toBe('');
  });

  it('verify s aktuální fází vypíše prompt UI/UX kontroly', async () => {
    await setupProject(
      [{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }] }],
      1,
    );
    await context('verify');
    expect(process.exitCode).toBeUndefined();
    expect(out).toContain('krok **verify**');
    expect(out).toContain('Fáze 1: Fáze A');
    expect(out).toContain('ještě neuzavřená');
  });

  it('verify bez aktuální fáze vezme poslední uzavřenou', async () => {
    await setupProject(
      [
        { id: 1, title: 'Stará', goal: 'cíl', status: 'done' },
        { id: 2, title: 'Poslední hotová', goal: 'cíl', status: 'done' },
      ],
      null,
    );
    await context('verify');
    expect(process.exitCode).toBeUndefined();
    expect(out).toContain('Fáze 2: Poslední hotová');
    expect(out).toContain('je už uzavřená');
  });

  it('verify načte verify body z reportu fáze', async () => {
    await setupProject(
      [{ id: 1, title: 'Fáze A', goal: 'cíl', status: 'doing', steps: [{ title: 'krok 1', status: 'doing' }] }],
      1,
    );
    await ensureRunDir(cwd);
    await writeFile(
      runReportPath(cwd, 1),
      [
        '---', 'phase: 1', 'verdict: done', 'steps:', '  - title: "krok 1"', '    status: done',
        'verify:', '  - title: "mrkni na UI"', '---', '', 'text',
      ].join('\n'),
      'utf-8',
    );
    await context('verify');
    expect(out).toContain('mrkni na UI');
  });
});
