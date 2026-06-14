import { describe, expect, it } from 'vitest';
import {
  buildAdversarialSessionPrompt,
  buildDecisionSessionPrompt,
  buildDoneSessionPrompt,
  buildNextSessionPrompt,
  buildPlanSessionPrompt,
  buildProjectSessionPrompt,
  buildVerifySessionPrompt,
} from './sessionContext.js';
import { ASK_AND_STOP_HINT } from './sessionHints.js';
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

  it('surfaces open adversarial findings as candidate fix phases', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), {
      openFindings: [
        { id: '155-1', severity: 'blocker', where: 'src/foo.ts:42', title: 'unchecked null' },
        { id: '156-2', severity: 'nit', title: 'rename helper' },
      ],
    });
    expect(p).toContain('Open adversarial findings');
    expect(p).toContain('155-1 · blocker · src/foo.ts:42 — unchecked null');
    expect(p).toContain('156-2 · nit — rename helper');
    // The prompt warns there is no auto-tick (unlike --from-todo).
    expect(p).toContain('no auto-tick');
    expect(p).toContain('resolved by hand');
  });

  it('omits the findings block when there are no open findings', () => {
    const p = buildNextSessionPrompt(PROJECT, state(), { openFindings: [] });
    expect(p).not.toContain('Open adversarial findings');
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

  it('reference mode (warm): references project.md instead of inlining it', () => {
    const p = buildPlanSessionPrompt(PROJECT, phase, null, true);
    expect(p).toContain('.mini/project.md');
    expect(p).toContain('do not read it again');
    // The inlined project body must not appear.
    expect(p).not.toContain('Něco.');
  });

  it('default inlines the project (no useProjectRef flag)', () => {
    const p = buildPlanSessionPrompt(PROJECT, phase);
    expect(p).toContain('Něco.');
    expect(p).not.toContain('.mini/project.md');
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

  it('ADR jen tence ukáže na /mini:decision (full instrukce tam nejsou)', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: true, verify: [] });
    expect(p).toContain('Decision record (ADR)');
    // A thin pointer to the on-demand command, before the state moves.
    expect(p).toContain('/mini:decision');
    expect(p).toContain('before');
    // The full drafting machinery moved out of the done prompt.
    expect(p).not.toContain('mini decision --apply');
    expect(p).not.toContain('show it to the user');
  });

  it('pointer na /mini:decision nevkládá, když report chybí', () => {
    const p = buildDoneSessionPrompt({ phase, reportExists: false, verify: [] });
    expect(p).not.toContain('/mini:decision');
  });
});

describe('buildProjectSessionPrompt', () => {
  it('frames it as enriching the existing project and inlines the current project.md', () => {
    const p = buildProjectSessionPrompt(PROJECT);
    expect(p).toContain('**project** step');
    expect(p).toContain('enriches the existing');
    // The current project.md is inlined as the starting point.
    expect(p).toContain('# Demo');
    expect(p).toContain('Něco.');
    // Do not re-ask for the idea — it is already there.
    expect(p).toContain('Do not ask the user to describe the idea again');
  });

  it('runs the four-stage interview and stays critical', () => {
    const p = buildProjectSessionPrompt(PROJECT);
    expect(p).toContain('critical, not agreeable');
    expect(p).toContain('Approach');
    expect(p).toContain('Non-goals');
    expect(p).toContain('Success criteria');
    expect(p).toContain('small batch');
    // one-page steering doc, not a full spec
    expect(p).toContain('one-page steering doc');
  });

  it('gives the heredoc contract template and keeps existing NAME/FOR_WHOM/CONSTRAINTS', () => {
    const p = buildProjectSessionPrompt(PROJECT);
    expect(p).toContain('mini project --apply');
    expect(p).toContain("<<'EOF'");
    expect(p).toContain('NON_GOALS:');
    expect(p).toContain('Keep the existing NAME / FOR_WHOM / CONSTRAINTS');
    // It writes only project.md, never the state.
    expect(p).toContain('never touches');
  });
});

describe('buildDecisionSessionPrompt', () => {
  const phase: Phase = { id: 7, title: 'Rozcestí', goal: 'cíl', status: 'doing' };

  it('drží celou ADR instrukci a cílí na aktuální fázi přes mini decision --apply', () => {
    const p = buildDecisionSessionPrompt(phase);
    expect(p).toContain('**decision** step');
    expect(p).toContain('7: Rozcestí');
    expect(p).toContain('default is to write nothing');
    expect(p).toContain('show it to the user');
    expect(p).toContain('mini decision --apply');
    // It distinguishes the ADR from the CHANGELOG.
    expect(p).toContain('not** the CHANGELOG');
    // The current phase id is named so the write targets the right phase.
    expect(p).toContain('current phase (7)');
  });
});

describe('hardened ask-and-stop hint (Fable 5 prompt hardening)', () => {
  const phase: Phase = { id: 4, title: 'Fáze', goal: 'cíl', status: 'doing' };

  it('next: both the Ask-first block and the approval gate end the turn', () => {
    const p = buildNextSessionPrompt(PROJECT, state());
    expect(p).toContain(ASK_AND_STOP_HINT);
    // Saving is gated on approval in a later message, not the same turn.
    expect(p).toContain('Only after they approve');
  });

  it('plan: showing the steps ends the turn before mini plan --apply', () => {
    const p = buildPlanSessionPrompt(PROJECT, { ...phase, status: 'proposed' });
    expect(p).toContain(ASK_AND_STOP_HINT);
    expect(p).toContain('Only after they approve');
  });

  it('project: interview batches and the final draft end the turn', () => {
    const p = buildProjectSessionPrompt(PROJECT);
    expect(p).toContain(ASK_AND_STOP_HINT);
    expect(p).toContain('save only after the user approves');
  });

  it('decision: the ADR draft is approved across turns', () => {
    const p = buildDecisionSessionPrompt(phase);
    expect(p).toContain(ASK_AND_STOP_HINT);
  });

  it('done: both verify branches gate mini done --apply on a later message', () => {
    const withVerify = buildDoneSessionPrompt({
      phase,
      reportExists: true,
      verify: [{ title: 'check UI' }],
    });
    const withoutVerify = buildDoneSessionPrompt({ phase, reportExists: true, verify: [] });
    expect(withVerify).toContain(ASK_AND_STOP_HINT);
    expect(withoutVerify).toContain(ASK_AND_STOP_HINT);
  });

  it('verify: the interactive review asks one at a time and ends the turn', () => {
    const p = buildVerifySessionPrompt({ phase, phaseDone: false, verify: [], reportExists: true });
    expect(p).toContain(ASK_AND_STOP_HINT);
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

describe('buildAdversarialSessionPrompt', () => {
  const phase: Phase = {
    id: 5,
    title: 'New parser',
    goal: 'cíl',
    status: 'doing',
    steps: [{ title: 'Parse input', status: 'done', detail: 'tolerant parser' }],
  };

  it('rámuje to jako nezávislý red-team review a vyjmenuje 4 oblasti', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: false });
    expect(p).toContain('**adversarial** step');
    expect(p).toContain('did **not** write this code');
    expect(p).toContain('find what breaks it');
    expect(p).toContain('UNHAPPY PATH');
    expect(p).toContain('SILENT ASSUMPTIONS');
    expect(p).toContain('PREMATURE COMPLEXITY');
    expect(p).toContain('TESTS');
  });

  it('navede recenzenta na skutečný git diff', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: false });
    expect(p).toContain('git diff');
  });

  it('nálezy zapisuje voláním `mini findings add` do store, ne do reportu', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: false });
    expect(p).toContain('mini findings add');
    expect(p).toContain('--severity');
    expect(p).toContain('.mini/findings/');
    // The old run-report write path is gone — no section, no Edit into the report.
    expect(p).not.toContain('## Adversarial findings');
    expect(p).not.toContain('.mini/run/phase-005.md');
    // Status line goes to the human as a chat summary.
    expect(p).toContain('**adversarial: pass**');
    expect(p).toContain('**adversarial: findings**');
    expect(p).toContain('**adversarial: blocked**');
  });

  it('je report-only: nemodifikuje kód ani neposouvá stav fáze', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: false });
    expect(p).toContain('report only');
    expect(p).toContain('Do **not** modify');
    expect(p).toContain('move the phase state');
  });

  it('běží jedním průchodem — neptá se uživatele krok po kroku (na rozdíl od verify)', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: false });
    expect(p).not.toContain(ASK_AND_STOP_HINT);
  });

  it('u uzavřené fáze rámuje zpětný red-team, store je stejný (žádný zápis do paměti)', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: true });
    expect(p).toContain('already closed');
    expect(p).toContain('retrospective red-team review');
    // No separate memory-write branch any more — everything goes through the store.
    expect(p).not.toContain('.mini/memory/phase-005.md');
    expect(p).toContain('mini findings add');
  });

  it('u rozdělané fáze rámuje kontrolu před done', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: false });
    expect(p).toContain('not yet closed');
  });

  it('bez reportu jede měkce na git diff', () => {
    const p = buildAdversarialSessionPrompt({ phase, phaseDone: false });
    expect(p).toContain('no usable implementation report');
  });

  it('vykreslí kroky fáze a vloží volný text reportu, když je', () => {
    const p = buildAdversarialSessionPrompt({
      phase,
      phaseDone: false,
      reportBody: 'Poznámky z implementace.',
    });
    expect(p).toContain('Parse input');
    expect(p).toContain('Poznámky z implementace.');
  });
});
