import { describe, expect, it } from 'vitest';
import { buildAutoPhasePrompt } from './autoPhase.js';
import type { Phase } from '../state/types.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

describe('buildAutoPhasePrompt', () => {
  it('renders a phase with mixed-status steps (first iteration, no notes, no retry)', () => {
    const phase: Phase = {
      id: 9,
      title: 'Jeden průchod Claude na fázi',
      goal: 'auto pustí celou fázi v jednom Claude session',
      status: 'doing',
      steps: [
        { title: 'Prompt builder pro celou fázi', status: 'done' },
        { title: 'Typy reportu a .mini/run/ adresář', status: 'done' },
        { title: 'auto.ts jeden průchod + retry smyčka', status: 'doing' },
        { title: 'Snapshot testy auto-promptu', status: 'todo' },
        { title: 'starý nápad', status: 'skipped' },
      ],
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    expect(out).toContain('**Phase 9: Jeden průchod Claude na fázi**');
    expect(out).toContain('Goal: auto pustí celou fázi v jednom Claude session');
    expect(out).toContain('auto session');
    expect(out).toContain('- [done] Prompt builder pro celou fázi');
    expect(out).toContain('- [in progress] auto.ts jeden průchod + retry smyčka');
    expect(out).toContain('- [todo] Snapshot testy auto-promptu');
    expect(out).toContain('- [skipped] starý nápad');
    // První průchod nesmí mít retry blok.
    expect(out).not.toContain('# Retry');
    // Bez notes nesmí být sekce poznámek.
    expect(out).not.toContain('# Phase notes');
    // Auto report cesta a YAML šablona pro správnou fázi.
    expect(out).toContain('`.mini/run/phase-009.md`');
    expect(out).toContain('phase: 9');
    expect(out).toContain('verdict: done');
    expect(out).toContain('- title: "Prompt builder pro celou fázi"');
    expect(out).toContain('- title: "Snapshot testy auto-promptu"');
    expect(out).toMatchSnapshot();
  });

  it('renders a phase without steps (works on whole phase, empty YAML steps)', () => {
    const phase: Phase = {
      id: 1,
      title: 'Bootstrap',
      goal: 'CLI vrací --version',
      status: 'doing',
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    expect(out).toContain('**Phase 1: Bootstrap**');
    expect(out).toContain('Goal: CLI vrací --version');
    expect(out).toContain('(The phase is not broken down into steps — work on the whole phase at once.)');
    // V YAML vzorku musí mít sekce steps placeholder pro prázdný seznam, ne fiktivní položku.
    expect(out).toContain('[]  # the phase has no steps — leave an empty list');
    expect(out).toContain('`.mini/run/phase-001.md`');
    expect(out).toMatchSnapshot();
  });

  it('inserts discuss notes block when notes are provided', () => {
    const phase: Phase = {
      id: 4,
      title: 'Použít poznámky z diskuze',
      goal: 'auto-prompt vidí discuss notes',
      status: 'doing',
      steps: [{ title: 'načíst notes', status: 'todo' }],
    };
    const notes = `# Fáze 4 — Poznámky

## Záměr
auto má taky vidět diskusi

## Klíčová rozhodnutí
- notes se renderují identicky jako v do/plan promptu`;

    const out = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      discussNotes: notes,
    });

    expect(out).toContain('# Phase notes (from discussion)');
    expect(out).toContain('## Klíčová rozhodnutí');
    expect(out).toContain('auto má taky vidět diskusi');
    expect(out).toMatchSnapshot();
  });

  it('reference mód: místo inline textu vykreslí odkaz + read-once podmínku', () => {
    const phase: Phase = {
      id: 40,
      title: 'Reference mód',
      goal: 'do odkazuje místo inline',
      status: 'doing',
      steps: [{ title: 'krok', status: 'todo' }],
    };
    const notes = `# Fáze 40 — Poznámky

## Záměr
TENTO INLINE TEXT SE NESMÍ OBJEVIT`;

    const out = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      discussNotes: notes,
      useDiscussNotesRef: true,
    });

    // Nadpis zůstává (ať je blok rozpoznatelný), ale obsahuje odkaz, ne text.
    expect(out).toContain('# Phase notes (from discussion)');
    expect(out).toContain('.mini/discuss/phase-040.md');
    // Read-once formulace.
    expect(out).toContain('Read');
    expect(out).toContain('do not read them again');
    // Inline text poznámek se nesmí objevit.
    expect(out).not.toContain('TENTO INLINE TEXT SE NESMÍ OBJEVIT');
    expect(out).toMatchSnapshot();
  });

  it('reference mód použije id fáze v cestě k poznámkám', () => {
    const phase: Phase = {
      id: 7,
      title: 'Jiné id',
      status: 'doing',
      steps: [{ title: 'krok', status: 'todo' }],
    };

    const out = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      useDiscussNotesRef: true,
    });

    expect(out).toContain('.mini/discuss/phase-007.md');
    expect(out).not.toContain('.mini/discuss/phase-040.md');
  });

  it('projekt reference mód: místo inline textu projektu vykreslí odkaz + read-once', () => {
    const phase: Phase = {
      id: 41,
      title: 'Projekt reference',
      goal: 'do odkazuje na project.md místo inline',
      status: 'doing',
      steps: [{ title: 'krok', status: 'todo' }],
    };

    const out = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      useProjectRef: true,
    });

    // Nadpis projektu zůstává, ale tělo je odkaz + read-once, ne inline text.
    expect(out).toContain('# Project');
    expect(out).toContain('.mini/project.md');
    expect(out).toContain('Read');
    expect(out).toContain('do not read it again');
    // Inline text projektu se nesmí objevit.
    expect(out).not.toContain('Stavím nástroj X pro Y.');
    expect(out).toMatchSnapshot();
  });

  it('projekt: bez příznaku useProjectRef se inlinuje (default beze změny)', () => {
    const phase: Phase = {
      id: 41,
      title: 'Projekt inline',
      status: 'doing',
      steps: [{ title: 'krok', status: 'todo' }],
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    // Default inline: obsahuje text projektu a NEodkazuje na soubor.
    expect(out).toContain('Stavím nástroj X pro Y.');
    expect(out).not.toContain('.mini/project.md');
  });

  it('omits notes block when notes are null, undefined or blank', () => {
    const phase: Phase = {
      id: 2,
      title: 'Bez poznámek',
      status: 'doing',
      steps: [{ title: 'krok 1', status: 'todo' }],
    };

    const noNotes = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });
    const nullNotes = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      discussNotes: null,
    });
    const blankNotes = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      discussNotes: '   \n  \n',
    });

    expect(noNotes).not.toContain('# Phase notes (from discussion)');
    expect(nullNotes).not.toContain('# Phase notes (from discussion)');
    expect(blankNotes).not.toContain('# Phase notes (from discussion)');
    expect(nullNotes).toBe(noNotes);
    expect(blankNotes).toBe(noNotes);
  });

  it('renders retry block with iteration number and previous report path', () => {
    const phase: Phase = {
      id: 5,
      title: 'Retry kontext',
      goal: 'druhý pokus dostane info o předchozím',
      status: 'doing',
      steps: [
        { title: 'krok A', status: 'done' },
        { title: 'krok B', status: 'todo' },
      ],
    };

    const out = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      retry: {
        iteration: 2,
        previousReportPath: '.mini/run/phase-5.prev.md',
      },
    });

    expect(out).toContain('# Retry (iteration 2)');
    expect(out).toContain('`.mini/run/phase-5.prev.md`');
    expect(out).toMatchSnapshot();
  });

  it('omits retry block when retry is null or undefined', () => {
    const phase: Phase = {
      id: 6,
      title: 'První pokus',
      status: 'doing',
      steps: [{ title: 'krok', status: 'todo' }],
    };

    const noRetry = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });
    const nullRetry = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      retry: null,
    });

    expect(noRetry).not.toContain('# Retry');
    expect(nullRetry).not.toContain('# Retry');
    expect(nullRetry).toBe(noRetry);
  });

  it('escapes double quotes and backslashes in step titles for YAML sample', () => {
    const phase: Phase = {
      id: 7,
      title: 'Escape test',
      status: 'doing',
      steps: [
        { title: 'krok s "uvozovkami"', status: 'todo' },
        { title: 'krok s\\backslashem', status: 'todo' },
      ],
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    // V seznamu "Kroky" zůstávají tituly bez úprav.
    expect(out).toContain('- [todo] krok s "uvozovkami"');
    expect(out).toContain('- [todo] krok s\\backslashem');
    // V YAML šabloně musí být escapované (Claude bude kopírovat tento tvar).
    expect(out).toContain('- title: "krok s \\"uvozovkami\\""');
    expect(out).toContain('- title: "krok s\\\\backslashem"');
  });

  it('obsahuje instrukce a vzor pro pole verify', () => {
    const phase: Phase = {
      id: 11,
      title: 'Verify v promptu',
      goal: 'Claude ví, co patří do verify',
      status: 'doing',
      steps: [{ title: 'krok', status: 'todo' }],
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    // instrukce: verify = věci, co Claude sám neověřil (lidský pohled)
    expect(out).toContain('verify');
    expect(out).toContain('could not verify yourself');
    // vzor v YAML šabloně má title i detail
    expect(out).toContain('verify:');
    expect(out).toContain('detail:');
  });

  it('instruuje průběžný zápis kroků přes mini do --apply --step-done (fáze s kroky)', () => {
    const phase: Phase = {
      id: 12,
      title: 'Průběžný zápis',
      goal: 'Claude označuje hotové kroky průběžně',
      status: 'doing',
      steps: [{ title: 'krok 1', status: 'todo' }],
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    expect(out).toContain('# Tracking step progress');
    expect(out).toContain('mini do --apply --step-done');
  });

  it('vynechá blok průběžného zápisu u fáze bez kroků', () => {
    const phase: Phase = {
      id: 13,
      title: 'Bez kroků',
      goal: 'nic k průběžnému zápisu',
      status: 'doing',
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    expect(out).not.toContain('# Tracking step progress');
    expect(out).not.toContain('--step-done');
  });

  it('falls back to (nezadán) when phase has no goal', () => {
    const phase: Phase = {
      id: 8,
      title: 'Bez cíle',
      status: 'doing',
      steps: [{ title: 'jediný krok', status: 'todo' }],
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    expect(out).toContain('Goal: (not set)');
  });

  it('combines retry + discuss notes + steps in one prompt', () => {
    const phase: Phase = {
      id: 10,
      title: 'Vše dohromady',
      goal: 'třetí pokus s poznámkami',
      status: 'doing',
      steps: [
        { title: 'hotový krok', status: 'done' },
        { title: 'zbývající krok', status: 'todo' },
      ],
    };

    const out = buildAutoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      discussNotes: '## Záměr\nshrnutí z diskuze',
      retry: {
        iteration: 3,
        previousReportPath: '.mini/run/phase-10.prev.md',
      },
    });

    expect(out).toContain('# Retry (iteration 3)');
    expect(out).toContain('# Phase notes (from discussion)');
    expect(out).toContain('shrnutí z diskuze');
    expect(out).toContain('- [done] hotový krok');
    expect(out).toContain('- [todo] zbývající krok');
    expect(out).toContain('`.mini/run/phase-010.md`');
    expect(out).toMatchSnapshot();
  });

  it('renders step detail on an indented line below the title (only when present)', () => {
    const phase: Phase = {
      id: 9,
      title: 'Detail v krocích',
      goal: 'detail se vykreslí pod title',
      status: 'doing',
      steps: [
        {
          title: 'Prompt builder pro celou fázi',
          status: 'done',
          detail: 'buildAutoPhasePrompt vrací prompt s YAML reportem; pokryto snapshotem',
        },
        { title: 'Bez detailu', status: 'todo' },
      ],
    };

    const out = buildAutoPhasePrompt({ projectMd: PROJECT_MD, phase });

    // Krok s detailem: title na svém řádku, detail odsazený (4 mezery) pod ním.
    expect(out).toContain(
      '- [done] Prompt builder pro celou fázi\n    buildAutoPhasePrompt vrací prompt s YAML reportem; pokryto snapshotem',
    );
    // Krok bez detailu zůstává jednořádkový.
    expect(out).toContain('- [todo] Bez detailu\n');
    // sampleSteps klonuje jen title — detail se do YAML vzorku nepropisuje.
    expect(out).toContain('- title: "Prompt builder pro celou fázi"');
    expect(out).not.toContain('    status: done\n    buildAutoPhasePrompt');
    expect(out).toMatchSnapshot();
  });
});
