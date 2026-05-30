import { describe, expect, it } from 'vitest';
import { buildDoPhasePrompt } from './doPhase.js';
import type { Phase } from '../state/types.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

describe('buildDoPhasePrompt', () => {
  it('handles a phase that has no steps (works on whole phase)', () => {
    const phase: Phase = {
      id: 1,
      title: 'Bootstrap',
      goal: 'CLI vrací --version',
      status: 'doing',
    };

    const out = buildDoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      focusedStep: null,
    });

    expect(out).toContain('**Fáze 1: Bootstrap**');
    expect(out).toContain('Cíl: CLI vrací --version');
    expect(out).toContain('(Fáze není rozmenená na kroky — pracuj na celé fázi najednou.)');
    expect(out).toContain('Implementuj celou fázi tak, aby splňovala cíl.');
    expect(out).not.toContain('← pracuj na tomhle');
    expect(out).not.toContain('Implementuj krok:');
    expect(out).toMatchSnapshot();
  });

  it('renders steps with a focus marker on the focused step only', () => {
    const phase: Phase = {
      id: 3,
      title: 'Snapshot testy',
      goal: 'prompty mají testy',
      status: 'doing',
      steps: [
        { title: 'rozhodnout framework', status: 'done' },
        { title: 'napsat snapshoty', status: 'doing' },
        { title: 'spustit npm test', status: 'todo' },
        { title: 'starý nápad', status: 'skipped' },
      ],
    };
    const focusedStep = phase.steps![1]!;

    const out = buildDoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      focusedStep,
    });

    expect(out).toContain('- [hotovo] rozhodnout framework');
    expect(out).toContain('- [dělá se] napsat snapshoty   ← pracuj na tomhle');
    expect(out).toContain('- [čeká] spustit npm test');
    expect(out).toContain('- [odloženo] starý nápad');
    expect(out).toContain('Implementuj krok: "napsat snapshoty".');
    expect(out).not.toContain('Implementuj celou fázi');
    // marker appears exactly once
    expect(out.match(/← pracuj na tomhle/g)?.length).toBe(1);
    expect(out).toMatchSnapshot();
  });

  it('renders steps without any focus marker when focusedStep is null', () => {
    const phase: Phase = {
      id: 4,
      title: 'Cleanup',
      goal: 'tests projdou',
      status: 'doing',
      steps: [
        { title: 'odstranit dead code', status: 'todo' },
        { title: 'aktualizovat README', status: 'todo' },
      ],
    };

    const out = buildDoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      focusedStep: null,
    });

    expect(out).toContain('- [čeká] odstranit dead code');
    expect(out).toContain('- [čeká] aktualizovat README');
    expect(out).not.toContain('← pracuj na tomhle');
    expect(out).toContain('Implementuj celou fázi tak, aby splňovala cíl.');
    expect(out).toMatchSnapshot();
  });

  it('falls back to (nezadán) when phase has no goal', () => {
    const phase: Phase = {
      id: 9,
      title: 'Bez cíle',
      status: 'doing',
    };

    const out = buildDoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      focusedStep: null,
    });

    expect(out).toContain('Cíl: (nezadán)');
  });

  it('renders step detail on an indented line, with the focus marker still on the title', () => {
    const phase: Phase = {
      id: 6,
      title: 'Detail v krocích',
      goal: 'detail se vykreslí',
      status: 'doing',
      steps: [
        {
          title: 'rozhodnout framework',
          status: 'done',
          detail: 'vitest; běží přes npm test',
        },
        {
          title: 'napsat snapshoty',
          status: 'doing',
          detail: 'snapshot test pokrývá prompt',
        },
        { title: 'bez detailu', status: 'todo' },
      ],
    };
    const focusedStep = phase.steps![1]!;

    const out = buildDoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      focusedStep,
    });

    // Detail jde na odsazený řádek pod title.
    expect(out).toContain('- [hotovo] rozhodnout framework\n    vitest; běží přes npm test');
    // U focusedStep zůstává marker na řádku s title, detail je až pod ním.
    expect(out).toContain(
      '- [dělá se] napsat snapshoty   ← pracuj na tomhle\n    snapshot test pokrývá prompt',
    );
    // Krok bez detailu zůstává jednořádkový.
    expect(out).toContain('- [čeká] bez detailu\n');
    // marker se objeví právě jednou
    expect(out.match(/← pracuj na tomhle/g)?.length).toBe(1);
    expect(out).toMatchSnapshot();
  });

  it('does not mark a step when focusedStep is a different object with the same title', () => {
    const phase: Phase = {
      id: 5,
      title: 'Identity check',
      status: 'doing',
      steps: [{ title: 'krok A', status: 'todo' }],
    };
    const lookalike = { title: 'krok A', status: 'todo' as const };

    const out = buildDoPhasePrompt({
      projectMd: PROJECT_MD,
      phase,
      focusedStep: lookalike,
    });

    // buildDoPhasePrompt compares by reference, so a lookalike must NOT be marked,
    // and the prompt still tells Claude which step to implement.
    expect(out).not.toContain('← pracuj na tomhle');
    expect(out).toContain('Implementuj krok: "krok A".');
  });
});
