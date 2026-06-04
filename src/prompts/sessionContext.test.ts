import { describe, expect, it } from 'vitest';
import {
  buildDoneSessionPrompt,
  buildNextSessionPrompt,
  buildPlanSessionPrompt,
  buildVerifySessionPrompt,
} from './sessionContext.js';
import type { Phase, ProjectState } from '../state/types.js';

const PROJECT = '# Demo\n\n## Co stavím\nNěco.';

function state(phases: Phase[] = [], currentPhaseId: number | null = null): ProjectState {
  return { version: 2, createdAt: '2026-01-01T00:00:00Z', currentPhaseId, phases };
}

describe('buildNextSessionPrompt', () => {
  it('zmíní příkaz mini next --apply a krok next', () => {
    const p = buildNextSessionPrompt(PROJECT, state());
    expect(p).toContain('mini next --apply');
    expect(p).toContain('--title');
    expect(p).toContain('--goal');
    expect(p).toContain('**next** step');
  });

  it('vloží nápad uživatele, když je zadaný', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), { userHint: 'přidej export do CSV' });
    expect(p).toContain("User's idea");
    expect(p).toContain('přidej export do CSV');
  });

  it('bez nápadu sekci Nápad uživatele nevkládá', () => {
    const p = buildNextSessionPrompt(PROJECT, state());
    expect(p).not.toContain("User's idea");
  });

  it('bez nápadu přiměje Claude nejdřív se zeptat na vlastní plán', () => {
    const p = buildNextSessionPrompt(PROJECT, state());
    expect(p).toContain('Ask first');
    expect(p).toContain('leave it up to you');
  });

  it('se zadaným nápadem se na vlastní plán neptá', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), { userHint: 'přidej export do CSV' });
    expect(p).not.toContain('Ask first');
  });

  it('vypíše dosavadní fáze, pokud existují', () => {
    const phases: Phase[] = [{ id: 1, title: 'Základ', status: 'done' }];
    const p = buildNextSessionPrompt(PROJECT, state(phases, 1));
    expect(p).toContain('1. Základ');
    expect(p).toContain('Progress so far');
  });

  it('vloží shrnutí poslední fáze z paměti', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), { lastMemoryMd: 'minule jsme udělali X' });
    expect(p).toContain('Last phase');
    expect(p).toContain('minule jsme udělali X');
  });

  it('surfaces open todo items as candidate ideas with their archive numbers', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), {
      openTodos: [
        { index: 3, text: 'add CSV export' },
        { index: 7, text: 'support plugins' },
      ],
    });
    expect(p).toContain('Ideas in the backlog');
    expect(p).toContain('- [3] add CSV export');
    expect(p).toContain('- [7] support plugins');
    // The prompt points Claude at --from-todo so the source item is auto-ticked.
    expect(p).toContain('--from-todo');
  });

  it('omits the backlog block when there are no open todos', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), { openTodos: [] });
    expect(p).not.toContain('Ideas in the backlog');
  });

  it('without a hint, offers to stash extra ideas into the todo archive', () => {
    const p = buildNextSessionPrompt(PROJECT, state());
    expect(p).toContain('mini todo add');
    expect(p).toContain('2-3');
  });

  it('with a user hint, does not add the stash-into-todo instruction', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), { userHint: 'add CSV export' });
    expect(p).not.toContain('mini todo add');
  });
});

describe('buildPlanSessionPrompt', () => {
  const phase: Phase = { id: 2, title: 'Plánovaná', goal: 'cíl', status: 'proposed' };

  it('zmíní mini plan --apply přes stdin', () => {
    const p = buildPlanSessionPrompt(PROJECT, phase);
    expect(p).toContain('mini plan --apply');
    expect(p).toContain('Phase 2: Plánovaná');
  });

  it('vloží poznámky z diskuse, když jsou', () => {
    const p = buildPlanSessionPrompt(PROJECT, phase, '## Záměr\nudělat to dobře');
    expect(p).toContain('Phase notes (from discussion)');
    expect(p).toContain('udělat to dobře');
  });

  it('upozorní, že existující kroky uložení přepíše', () => {
    const withSteps: Phase = { ...phase, steps: [{ title: 'starý krok', status: 'todo' }] };
    const p = buildPlanSessionPrompt(PROJECT, withSteps);
    expect(p).toContain('starý krok');
    expect(p).toContain('overwrite');
  });

  it('navede na krátký title + volitelný detail a formát `title :: detail`', () => {
    const p = buildPlanSessionPrompt(PROJECT, phase);
    expect(p).toContain('title');
    expect(p).toContain('detail');
    expect(p).toContain('title :: detail');
    expect(p).toContain('8 words');
  });
});

describe('buildDoneSessionPrompt', () => {
  const phase: Phase = { id: 3, title: 'Hotová', goal: 'cíl', status: 'doing' };

  it('když report chybí, pošle uživatele na /mini:do', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: false, verify: [] });
    expect(p).toContain('/mini:do');
    expect(p).toContain('is missing');
  });

  it('bez verify bodů nabídne prosté mini done --apply', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: true, verify: [] });
    expect(p).toContain('mini done --apply');
    expect(p).not.toContain('--accept-verify');
  });

  it('zmíní /clear, opt-in --push a možnost --bump', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: true, verify: [] });
    expect(p).toContain('/clear');
    expect(p).toContain('--push');
    expect(p).toContain('--bump');
  });

  it('s verify body vyžaduje --accept-verify a vypíše je', () => {
    const p = buildDoneSessionPrompt({
      phase,
      reportExists: true,
      verify: [{ title: 'zkontroluj UI', detail: 'tlačítko je modré' }],
    });
    expect(p).toContain('--accept-verify');
    expect(p).toContain('zkontroluj UI');
    expect(p).toContain('tlačítko je modré');
  });

  it('vloží volný text reportu, když je', () => {
    const p = buildDoneSessionPrompt({
      phase,
      reportExists: true,
      reportBody: 'Všechno se povedlo.',
      verify: [],
    });
    expect(p).toContain('Všechno se povedlo.');
  });

  it('instruuje aktualizovat CHANGELOG.md (Unreleased) před mini done --apply', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: true, verify: [] });
    expect(p).toContain('CHANGELOG.md');
    expect(p).toContain('## [Unreleased]');
    expect(p).toContain('keepachangelog');
    expect(p).toContain('### Added');
    expect(p).toContain('### Changed');
    expect(p).toContain('### Fixed');
  });

  it('CHANGELOG sekci nevkládá, když report chybí', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: false, verify: [] });
    expect(p).not.toContain('CHANGELOG.md');
  });

  it('instruuje psát ADR jen na reálném rozcestí, přes mini decision --apply', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: true, verify: [] });
    expect(p).toContain('Decision record (ADR)');
    expect(p).toContain('default is to write nothing');
    expect(p).toContain('mini decision --apply');
    // ADR draft is shown to the user, not written silently.
    expect(p).toContain('show it to the user');
    // ADR is distinguished from the CHANGELOG.
    expect(p).toContain('not** the CHANGELOG');
  });

  it('ADR sekci nevkládá, když report chybí', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: false, verify: [] });
    expect(p).not.toContain('mini decision --apply');
  });
});

describe('buildVerifySessionPrompt', () => {
  const phase: Phase = {
    id: 5,
    title: 'Nové UI',
    goal: 'cíl',
    status: 'doing',
    steps: [{ title: 'Tlačítko Uložit', status: 'done', detail: 'modrá barva' }],
  };

  it('vykreslí krok verify a hloubkovou UI/UX kontrolu', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: false, verify: [], reportExists: true });
    expect(p).toContain('**verify** step');
    expect(p).toContain('in-depth UI/UX review');
  });

  it('zapisuje nálezy do reportu, ale stav fáze neposouvá', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: false, verify: [], reportExists: true });
    expect(p).toContain('## Verify findings');
    expect(p).toContain('.mini/run/phase-005.md');
    expect(p).toContain('do not move');
    // už to není čistě read-only krok
    expect(p).not.toContain('do not write anything and change no state');
  });

  it('když report chybí, navede ho založit', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: false, verify: [], reportExists: false });
    expect(p).toContain('does not exist yet');
    expect(p).toContain('## Verify findings');
  });

  it('u uzavřené fáze zapisuje nálezy i do paměti', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: true, verify: [], reportExists: true });
    expect(p).toContain('.mini/memory/phase-005.md');
    expect(p).toContain('already closed');
  });

  it('u rozdělané fáze do paměti nepíše', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: false, verify: [], reportExists: true });
    expect(p).not.toContain('.mini/memory/phase-005.md');
  });

  it('u rozdělané fáze rámuje kontrolu před done', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: false, verify: [], reportExists: true });
    expect(p).toContain('not yet closed');
    expect(p).toContain('/mini:done');
  });

  it('u uzavřené fáze rámuje zpětnou kontrolu', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: true, verify: [], reportExists: true });
    expect(p).toContain('is already closed');
    expect(p).toContain('retrospective in-depth review');
  });

  it('vypíše verify body z reportu', () => {
    const p = buildVerifySessionPrompt({
      phase,
      phaseDone: true,
      verify: [{ title: 'zkontroluj barvu', detail: 'má být modrá' }],
      reportExists: true,
    });
    expect(p).toContain('zkontroluj barvu');
    expect(p).toContain('má být modrá');
  });

  it('bez verify bodů vede kontrolu podle cíle a kroků', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: false, verify: [], reportExists: true });
    expect(p).toContain('no explicit verify items');
    expect(p).toContain('Tlačítko Uložit');
  });

  it('vloží volný text reportu, když je', () => {
    const p = buildVerifySessionPrompt({
      phase,
      phaseDone: true,
      verify: [],
      reportBody: 'Poznámky pro člověka.',
      reportExists: true,
    });
    expect(p).toContain('Poznámky pro člověka.');
  });
});
