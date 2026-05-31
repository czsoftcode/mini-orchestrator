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

    expect(out).toContain('**Phase 1: Bootstrap**');
    expect(out).toContain('Goal: CLI vrací --version');
    expect(out).toContain('(The phase is not broken down into steps — work on the whole phase at once.)');
    expect(out).toContain('Implement the whole phase so that it meets the goal.');
    expect(out).not.toContain('← work on this');
    expect(out).not.toContain('Implement the step:');
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

    expect(out).toContain('- [done] rozhodnout framework');
    expect(out).toContain('- [in progress] napsat snapshoty   ← work on this');
    expect(out).toContain('- [todo] spustit npm test');
    expect(out).toContain('- [skipped] starý nápad');
    expect(out).toContain('Implement the step: "napsat snapshoty".');
    expect(out).not.toContain('Implement the whole phase');
    // marker appears exactly once
    expect(out.match(/← work on this/g)?.length).toBe(1);
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

    expect(out).toContain('- [todo] odstranit dead code');
    expect(out).toContain('- [todo] aktualizovat README');
    expect(out).not.toContain('← work on this');
    expect(out).toContain('Implement the whole phase so that it meets the goal.');
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

    expect(out).toContain('Goal: (not set)');
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
    expect(out).toContain('- [done] rozhodnout framework\n    vitest; běží přes npm test');
    // U focusedStep zůstává marker na řádku s title, detail je až pod ním.
    expect(out).toContain(
      '- [in progress] napsat snapshoty   ← work on this\n    snapshot test pokrývá prompt',
    );
    // Krok bez detailu zůstává jednořádkový.
    expect(out).toContain('- [todo] bez detailu\n');
    // marker se objeví právě jednou
    expect(out.match(/← work on this/g)?.length).toBe(1);
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
    expect(out).not.toContain('← work on this');
    expect(out).toContain('Implement the step: "krok A".');
  });
});
