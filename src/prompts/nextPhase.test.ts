import { describe, expect, it } from 'vitest';
import { buildNextPhasePrompt } from './nextPhase.js';
import type { ProjectState } from '../state/types.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

function emptyState(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [],
  };
}

describe('buildNextPhasePrompt', () => {
  it('uses čerstvě-založený copy when there are no phases', () => {
    const out = buildNextPhasePrompt(PROJECT_MD, emptyState());

    expect(out).toContain('# Postup');
    expect(out).toContain('čerstvě založený');
    expect(out).not.toContain('# Dosavadní postup');
    expect(out).toMatchSnapshot();
  });

  it('renders one-line history per phase, without goals/notes/steps', () => {
    const state: ProjectState = {
      ...emptyState(),
      currentPhaseId: 3,
      phases: [
        {
          id: 1,
          title: 'Bootstrap',
          status: 'done',
          goal: 'CLI vrací --version',
          steps: [
            { title: 'init package', status: 'done' },
            { title: 'přidat commander', status: 'done' },
          ],
        },
        {
          id: 2,
          title: 'Stav v JSON',
          status: 'done',
          goal: 'state.json se ukládá atomicky',
          humanNotes: 'málem jsme přepsali stav, viz incident',
        },
        {
          id: 3,
          title: 'Snapshot testy',
          status: 'doing',
          goal: 'prompty mají testy',
          steps: [
            { title: 'rozhodnout framework', status: 'done' },
            { title: 'napsat snapshoty', status: 'doing' },
            { title: 'spustit npm test', status: 'todo' },
          ],
        },
        {
          id: 4,
          title: 'Refactor',
          status: 'proposed',
        },
        {
          id: 5,
          title: 'Experiment',
          status: 'skipped',
          humanNotes: 'odloženo, nepotřebné',
        },
      ],
    };

    const out = buildNextPhasePrompt(PROJECT_MD, state);

    expect(out).toContain('# Dosavadní postup');
    expect(out).toContain('- [hotovo] 1. Bootstrap');
    expect(out).toContain('- [dělá se] 3. Snapshot testy');
    expect(out).toContain('- [návrh] 4. Refactor');
    expect(out).toContain('- [odloženo] 5. Experiment');
    // historie je zkomprimovaná na jeden řádek na fázi — žádné cíle, poznámky ani kroky
    expect(out).not.toContain('Cíl: CLI vrací --version');
    expect(out).not.toContain('Poznámka:');
    expect(out).not.toContain('Kroky:');
    expect(out).toContain('TITLE: <stručný název, max 5 slov>');
    expect(out).toMatchSnapshot();
  });

  it('trims leading/trailing whitespace from projectMd', () => {
    const padded = `\n\n   ${PROJECT_MD}   \n\n`;
    const out = buildNextPhasePrompt(padded, emptyState());

    expect(out).toContain(`# Projekt\n${PROJECT_MD}`);
    expect(out).not.toContain('# Projekt\n\n\n');
  });

  it('includes user hint block when userHint is provided', () => {
    const out = buildNextPhasePrompt(PROJECT_MD, emptyState(), '  chci přidat tmavý režim do UI  ');

    expect(out).toContain('# Nápad uživatele');
    expect(out).toContain('chci přidat tmavý režim do UI');
    expect(out).not.toContain('"""\n  chci');
  });

  it('accepts options object form for userHint', () => {
    const out = buildNextPhasePrompt(PROJECT_MD, emptyState(), { userHint: 'dark mode' });
    expect(out).toContain('# Nápad uživatele');
    expect(out).toContain('dark mode');
  });

  it('omits hint block when userHint is empty or whitespace', () => {
    const out1 = buildNextPhasePrompt(PROJECT_MD, emptyState(), '');
    const out2 = buildNextPhasePrompt(PROJECT_MD, emptyState(), '   \n\t  ');
    const out3 = buildNextPhasePrompt(PROJECT_MD, emptyState());

    expect(out1).not.toContain('# Nápad uživatele');
    expect(out2).not.toContain('# Nápad uživatele');
    expect(out3).not.toContain('# Nápad uživatele');
  });

  it('includes last memory block when lastMemoryMd is provided', () => {
    const lastMemoryMd = '# Fáze 17 — Paměť\n\n## Co se udělalo\n- záznam paměti po fázi\n';
    const out = buildNextPhasePrompt(PROJECT_MD, emptyState(), { lastMemoryMd });

    expect(out).toContain('# Poslední fáze');
    expect(out).toContain('## Co se udělalo');
    expect(out).toContain('záznam paměti po fázi');
  });

  it('omits last memory block when lastMemoryMd is empty or whitespace', () => {
    const out1 = buildNextPhasePrompt(PROJECT_MD, emptyState(), { lastMemoryMd: '' });
    const out2 = buildNextPhasePrompt(PROJECT_MD, emptyState(), { lastMemoryMd: '   \n  ' });

    expect(out1).not.toContain('# Poslední fáze');
    expect(out2).not.toContain('# Poslední fáze');
  });

  it('combines last memory and user hint together', () => {
    const out = buildNextPhasePrompt(PROJECT_MD, emptyState(), {
      userHint: 'přidej tmavý režim',
      lastMemoryMd: '# Fáze 17\n\n## Co se udělalo\n',
    });
    expect(out).toContain('# Poslední fáze');
    expect(out).toContain('# Nápad uživatele');
    expect(out).toContain('přidej tmavý režim');
    // pořadí: poslední fáze pak nápad
    expect(out.indexOf('# Poslední fáze')).toBeLessThan(out.indexOf('# Nápad uživatele'));
  });

  it('uses všech pět štítků fází', () => {
    const state: ProjectState = {
      ...emptyState(),
      phases: [
        { id: 1, title: 'A', status: 'done' },
        { id: 2, title: 'B', status: 'doing' },
        { id: 3, title: 'C', status: 'planned' },
        { id: 4, title: 'D', status: 'proposed' },
        { id: 5, title: 'E', status: 'skipped' },
      ],
    };

    const out = buildNextPhasePrompt(PROJECT_MD, state);

    expect(out).toContain('[hotovo] 1.');
    expect(out).toContain('[dělá se] 2.');
    expect(out).toContain('[plán] 3.');
    expect(out).toContain('[návrh] 4.');
    expect(out).toContain('[odloženo] 5.');
  });
});
