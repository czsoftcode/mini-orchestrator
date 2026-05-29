import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { next, parseSuggestion } from './next.js';
import { askClaude } from '../claude/ask.js';
import { load, save, writeProject } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';

// Claude session nahrazujeme — auto next si jen vyžádá návrh fáze.
vi.mock('../claude/ask.js', () => ({
  askClaude: vi.fn(),
}));

const askClaudeMock = vi.mocked(askClaude);

function makeState(phases: Phase[], currentPhaseId: number | null): ProjectState {
  return {
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId,
    phases,
  };
}

describe('parseSuggestion', () => {
  it('parses TITLE + GOAL on consecutive lines', () => {
    const out = parseSuggestion('TITLE: Bootstrap CLI\nGOAL: mini --version vypíše verzi');
    expect(out).toEqual({ title: 'Bootstrap CLI', goal: 'mini --version vypíše verzi' });
  });

  it('trims surrounding whitespace from values', () => {
    const out = parseSuggestion('TITLE:    Stav v JSON   \nGOAL:   atomické zapsání   ');
    expect(out).toEqual({ title: 'Stav v JSON', goal: 'atomické zapsání' });
  });

  it('ignores surrounding prose around the markers', () => {
    const text = [
      'Tady je můj návrh:',
      '',
      'TITLE: Testy parserů',
      'GOAL: parsery jsou pokryté testy',
      '',
      'Hotovo, čekám na zpětnou vazbu.',
    ].join('\n');
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'Testy parserů', goal: 'parsery jsou pokryté testy' });
  });

  it('accepts the "-" sentinel as the title (signals project done)', () => {
    const out = parseSuggestion('TITLE: -\nGOAL: -');
    expect(out).toEqual({ title: '-', goal: '-' });
  });

  it('matches markers anywhere in the text (multiline mode)', () => {
    const text = 'random first line\nTITLE: Snapshot testy\nrandom middle\nGOAL: kryté snapshoty';
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'Snapshot testy', goal: 'kryté snapshoty' });
  });

  it('returns null when input is empty', () => {
    expect(parseSuggestion('')).toBeNull();
  });

  it('returns null when only TITLE is present', () => {
    expect(parseSuggestion('TITLE: Refactor')).toBeNull();
  });

  it('returns null when only GOAL is present', () => {
    expect(parseSuggestion('GOAL: udělat něco')).toBeNull();
  });

  it('returns null when TITLE value is empty after trim', () => {
    expect(parseSuggestion('TITLE:    \nGOAL: nějaký cíl')).toBeNull();
  });

  it('returns null when markers are not at line start', () => {
    expect(parseSuggestion('foo TITLE: bar\nbaz GOAL: qux')).toBeNull();
  });

  it('returns null on garbage input', () => {
    expect(parseSuggestion('Tohle je naprosto jiná odpověď bez markerů.')).toBeNull();
  });

  it('picks the first occurrence when markers are repeated', () => {
    const text = 'TITLE: První\nGOAL: cíl A\nTITLE: Druhý\nGOAL: cíl B';
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'První', goal: 'cíl A' });
  });
});

describe('next({ auto: true }) — číslování fází (W2)', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-next-auto-'));
    process.chdir(cwd);
    askClaudeMock.mockReset();
    askClaudeMock.mockResolvedValue({
      text: 'TITLE: Nová fáze\nGOAL: něco hotového',
    });
    await writeProject('# Projekt', cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('přidělí celé ID, i když ve stavu existuje opravná podfáze (21.1)', async () => {
    await save(
      makeState(
        [
          { id: 21, title: 'Rodič', status: 'done' },
          { id: 21.1, title: 'Oprava', status: 'done', steps: [] },
        ],
        null,
      ),
      cwd,
    );

    const r = await next({ auto: true });

    expect(r.ok).toBe(true);
    const loaded = await load(cwd);
    const ids = loaded.phases.map((p) => p.id);
    // Nová fáze musí být 22, ne 22.1 (Math.floor zahodí desetinnou část 21.1).
    expect(ids).toContain(22);
    expect(ids.some((id) => id === 22.1)).toBe(false);
  });
});
