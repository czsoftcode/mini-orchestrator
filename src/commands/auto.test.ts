import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureRunDir, runReportPath } from '../state/runReport.js';
import { load, save, writeProject } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';

// V auto módu se interaktivní `ask` nikdy nesmí volat. Pokud ho cokoliv
// v řetězci next → plan → do → done omylem zavolá, test musí spadnout —
// jinak by uživatel reálně dostal prompt a `mini auto` by se zaseknul.
vi.mock('../ui/ask.js', () => ({
  ask: vi.fn(async () => {
    throw new Error('ask() nesmí být v auto módu zavoláno');
  }),
  nonEmpty: () => () => true as const,
  trim: (v: string) => v.trim(),
}));

// Mock Claude volání — žádné skutečné spawn(claude) v testech.
const askClaudeMock = vi.fn();
vi.mock('../claude/ask.js', () => ({
  askClaude: (...args: unknown[]) => askClaudeMock(...args),
}));

const workWithClaudeMock = vi.fn();
vi.mock('../claude/work.js', () => ({
  workWithClaude: (...args: unknown[]) => workWithClaudeMock(...args),
}));

const streamWithClaudeMock = vi.fn();
vi.mock('../claude/stream.js', () => ({
  streamWithClaude: (...args: unknown[]) => streamWithClaudeMock(...args),
}));

// Auto kompletuje fáze přes `done({ auto })`, který po finalizaci volá
// `commitAll`. V testu běžíme v tmpdir mimo git repo, ale ať se subprocesy
// `git` v testech nikdy nespouštějí, zatlučeme git modul nahrubo na „není repo".
vi.mock('../git.js', () => ({
  isGitRepo: vi.fn(async () => false),
  hasChanges: vi.fn(async () => false),
  commitAll: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
  currentBranch: vi.fn(async () => null),
  headSha: vi.fn(async () => null),
  headSubject: vi.fn(async () => null),
  isCleanWorkingTree: vi.fn(async () => true),
  softResetTo: vi.fn(async () => ({ ok: true, stdout: '', stderr: '' })),
}));

// Po nastavení mocků importujeme `auto` — Vitest hoistí mocky nad importy
// modulu pod testem.
const { auto } = await import('./auto.js');

function emptyState(): ProjectState {
  return {
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [],
  };
}

/**
 * Naimituje Claude session, která na konci zapíše report — `done({ auto })`
 * ho pak přečte a posune stav fáze. Bez tohohle side-effectu spadne done do
 * interaktivního fallbacku a test trefí mocknuté `ask`.
 *
 * Report označí všechny kroky aktuální fáze jako `done` (verdict `done`).
 */
function mockClaudeSessionWritingReport(cwd: string, getCurrentPhase: () => Phase) {
  return async () => {
    const phase = getCurrentPhase();
    const titles = phase.steps ?? [];
    const stepsYaml = titles.length
      ? titles
          .map(
            (s) =>
              `  - title: "${s.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n    status: done`,
          )
          .join('\n')
      : '  []';
    const body = `---\nphase: ${phase.id}\nverdict: done\nsteps:\n${stepsYaml}\n---\n\nReport z testovacího mocku.\n`;
    await ensureRunDir(cwd);
    await writeFile(runReportPath(cwd, phase.id), body, 'utf-8');
    return { exitCode: 0 };
  };
}

describe('auto() end-to-end', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-auto-e2e-'));
    process.chdir(cwd);

    askClaudeMock.mockReset();
    workWithClaudeMock.mockReset();
    streamWithClaudeMock.mockReset();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('proběhne celý cyklus next → plan → do → done bez jediného promptu', async () => {
    await writeProject('# Testovací projekt\n\nMinimal seed pro auto test.\n', cwd);
    await save(emptyState(), cwd);

    // První volání askClaude je `next` — vrátí návrh fáze.
    // Druhé je `plan` — vrátí seznam kroků.
    askClaudeMock
      .mockResolvedValueOnce({
        text: 'TITLE: První automatická fáze\nGOAL: ověřit že auto chain neprompted ani jednou',
      })
      .mockResolvedValueOnce({
        text: 'STEP: udělat něco malého\nSTEP: ověřit, že to funguje',
      });

    // `do` v auto módu jede neinteraktivně (bez --stream) přes workWithClaude.
    // Auto-varianta `doPhase` pouští Claude na CELOU fázi v jednom průchodu;
    // mock simuluje, že Claude zapsal report označující všechny kroky jako done.
    workWithClaudeMock.mockImplementation(
      mockClaudeSessionWritingReport(cwd, () => {
        // Fáze ještě nemusí být ve stavu, když se mock registruje (proběhne
        // next + plan předtím), takže ji čerpáme z aktuálního state při volání.
        const raw = readFileSync(join(cwd, '.mini', 'state.json'), 'utf-8');
        const parsed = JSON.parse(raw) as ProjectState;
        const cur = parsed.phases.find((p) => p.id === parsed.currentPhaseId);
        if (!cur) throw new Error('mock: žádná aktuální fáze ve stavu');
        return cur;
      }),
    );

    await auto();

    // Žádný stream nebyl použit (auto chain default → workWithClaude).
    expect(streamWithClaudeMock).not.toHaveBeenCalled();

    // Claude byl volán dvakrát na rozhodování (next + plan) a jednou
    // na práci (celá fáze v jednom průchodu).
    expect(askClaudeMock).toHaveBeenCalledTimes(2);
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);

    // Volání `do` musí Clauda spustit v acceptEdits, jinak by se Claude
    // zeptal na povolení každého edit-tool a celé auto by se zaseklo.
    for (const call of workWithClaudeMock.mock.calls) {
      const callOpts = call[1] as { permissionMode?: string; cwd?: string };
      expect(callOpts?.permissionMode).toBe('acceptEdits');
      expect(callOpts?.cwd).toBe(cwd);
    }

    // Stav po doběhnutí: fáze 1 existuje, je `done`, currentPhaseId je null.
    // Statusy jednotlivých kroků zatím nezkoumáme — v tomto mezistavu jde
    // všechno na `skipped`; jakmile přistane parser reportu, budou `done`.
    const reloaded = await load(cwd);
    expect(reloaded.phases).toHaveLength(1);
    const phase = reloaded.phases[0];
    expect(phase?.id).toBe(1);
    expect(phase?.title).toBe('První automatická fáze');
    expect(phase?.goal).toBe('ověřit že auto chain neprompted ani jednou');
    expect(phase?.status).toBe('done');
    expect(phase?.completedAt).toBeTypeOf('string');
    expect(phase?.steps).toHaveLength(2);
    expect(reloaded.currentPhaseId).toBeNull();

    // Auto-varianta `do` musí před spuštěním Claude vytvořit `.mini/run/`,
    // aby tam Claude mohl bez kolize zapsat report.
    const runDirStat = await stat(join(cwd, '.mini', 'run'));
    expect(runDirStat.isDirectory()).toBe(true);
  });

  it('pokračuje na rozdělané fázi bez planu a doběhne také bez promptu', async () => {
    await writeProject('# Test projekt\n', cwd);
    // Fáze, která už má kroky a jeden je `doing` — auto musí přeskočit
    // jak `next` (fáze existuje), tak `plan` (kroky existují) a jet rovnou
    // na `do` a `done`.
    await save(
      {
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentPhaseId: 1,
        phases: [
          {
            id: 1,
            title: 'Rozdělaná fáze',
            goal: 'dokončit jediný zbývající krok',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'done' },
              { title: 'krok 2', status: 'doing' },
            ],
          },
        ],
      },
      cwd,
    );

    workWithClaudeMock.mockImplementation(
      mockClaudeSessionWritingReport(cwd, () => {
        const raw = readFileSync(join(cwd, '.mini', 'state.json'), 'utf-8');
        const parsed = JSON.parse(raw) as ProjectState;
        const cur = parsed.phases.find((p) => p.id === parsed.currentPhaseId);
        if (!cur) throw new Error('mock: žádná aktuální fáze ve stavu');
        return cur;
      }),
    );

    await auto();

    // next ani plan se nesmí volat — fáze existuje a má kroky.
    expect(askClaudeMock).not.toHaveBeenCalled();
    expect(streamWithClaudeMock).not.toHaveBeenCalled();
    // Auto-varianta `do` pouští Claude na celou fázi v jednom průchodu — proto 1 volání.
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);

    const reloaded = await load(cwd);
    const phase = reloaded.phases[0];
    expect(phase?.status).toBe('done');
    expect(phase?.steps?.[1]?.status).toBe('done');
    expect(reloaded.currentPhaseId).toBeNull();
  });

  it('propaguje --max-turns z auto({maxTurns}) až do workWithClaude', async () => {
    await writeProject('# Test projekt\n', cwd);
    await save(
      {
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentPhaseId: 1,
        phases: [
          {
            id: 1,
            title: 'Fáze s limitem turnů',
            goal: 'ověřit, že se --max-turns propaguje',
            status: 'doing',
            steps: [
              { title: 'krok 1', status: 'doing' },
              { title: 'krok 2', status: 'todo' },
            ],
          },
        ],
      },
      cwd,
    );

    workWithClaudeMock.mockImplementation(
      mockClaudeSessionWritingReport(cwd, () => {
        const raw = readFileSync(join(cwd, '.mini', 'state.json'), 'utf-8');
        const parsed = JSON.parse(raw) as ProjectState;
        const cur = parsed.phases.find((p) => p.id === parsed.currentPhaseId);
        if (!cur) throw new Error('mock: žádná aktuální fáze ve stavu');
        return cur;
      }),
    );

    await auto({ maxTurns: 7 });

    expect(streamWithClaudeMock).not.toHaveBeenCalled();
    // Jeden průchod na celou fázi — workWithClaude se volá jednou.
    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    for (const call of workWithClaudeMock.mock.calls) {
      const callOpts = call[1] as { maxTurns?: number };
      expect(callOpts?.maxTurns).toBe(7);
    }
  });

  it('bez --max-turns je maxTurns v opts pro workWithClaude undefined', async () => {
    await writeProject('# Test projekt\n', cwd);
    await save(
      {
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        currentPhaseId: 1,
        phases: [
          {
            id: 1,
            title: 'Fáze bez limitu',
            goal: 'ověřit default chování',
            status: 'doing',
            steps: [{ title: 'krok 1', status: 'doing' }],
          },
        ],
      },
      cwd,
    );

    workWithClaudeMock.mockImplementation(
      mockClaudeSessionWritingReport(cwd, () => {
        const raw = readFileSync(join(cwd, '.mini', 'state.json'), 'utf-8');
        const parsed = JSON.parse(raw) as ProjectState;
        const cur = parsed.phases.find((p) => p.id === parsed.currentPhaseId);
        if (!cur) throw new Error('mock: žádná aktuální fáze ve stavu');
        return cur;
      }),
    );

    await auto();

    expect(workWithClaudeMock).toHaveBeenCalledTimes(1);
    const callOpts = workWithClaudeMock.mock.calls[0]![1] as { maxTurns?: number };
    expect(callOpts?.maxTurns).toBeUndefined();
  });
});
