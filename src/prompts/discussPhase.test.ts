import { describe, expect, it } from 'vitest';
import { buildDiscussPhasePrompt } from './discussPhase.js';
import type { Phase } from '../state/types.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

describe('buildDiscussPhasePrompt', () => {
  it('renders phase with explicit goal', () => {
    const phase: Phase = {
      id: 3,
      title: 'Diskusní session',
      goal: 'uživatel může prodiskutovat fázi před plánováním',
      status: 'proposed',
    };

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('**Phase 3: Diskusní session**');
    expect(out).toContain('Goal: uživatel může prodiskutovat fázi před plánováním');
    expect(out).not.toContain('(not set)');
    expect(out).toContain('DO NOT implement');
    expect(out).toMatchSnapshot();
  });

  it('falls back to (nezadán) when phase has no goal', () => {
    const phase: Phase = {
      id: 5,
      title: 'Refactor auth',
      status: 'proposed',
    };

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('**Phase 5: Refactor auth**');
    expect(out).toContain('Goal: (not set)');
    expect(out).toMatchSnapshot();
  });

  it('renders steps list when phase has steps', () => {
    const phase: Phase = {
      id: 7,
      title: 'Nová feature',
      goal: 'feature je hotová',
      status: 'planned',
      steps: [
        { title: 'připravit schéma', status: 'done' },
        { title: 'napsat handler', status: 'todo' },
        { title: 'starý nápad', status: 'skipped' },
      ],
    };

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('- [done] připravit schéma');
    expect(out).toContain('- [todo] napsat handler');
    expect(out).toContain('- [skipped] starý nápad');
    expect(out).not.toContain('← work on this');
    expect(out).toMatchSnapshot();
  });

  it('omits steps block when phase has no steps', () => {
    const phase: Phase = {
      id: 2,
      title: 'Bootstrap',
      goal: 'CLI vrací --version',
      status: 'proposed',
    };

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase);

    expect(out).not.toContain('Steps:');
    expect(out).toMatchSnapshot();
  });

  it('trims projectMd whitespace', () => {
    const phase: Phase = { id: 1, title: 'P1', status: 'proposed' };
    const out = buildDiscussPhasePrompt(`\n\n  ${PROJECT_MD}  \n\n`, phase);

    expect(out).toContain(`# Project\n${PROJECT_MD}\n`);
    expect(out).not.toContain('# Project\n\n');
  });

  it('reference mode (warm): references project.md instead of inlining it', () => {
    const phase: Phase = { id: 9, title: 'Warm discuss', status: 'proposed' };
    const out = buildDiscussPhasePrompt(PROJECT_MD, phase, true);

    // The heading stays, but the body is a read-once reference, not inline text.
    expect(out).toContain('# Project');
    expect(out).toContain('.mini/project.md');
    expect(out).toContain('do not read it again');
    expect(out).not.toContain('Stavím nástroj X pro Y.');
  });

  it('default (cold) still inlines the project', () => {
    const phase: Phase = { id: 9, title: 'Cold discuss', status: 'proposed' };
    const out = buildDiscussPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('Stavím nástroj X pro Y.');
    expect(out).not.toContain('.mini/project.md');
  });

  it('instructs Claude to read graph.json index first', () => {
    const phase: Phase = {
      id: 8,
      title: 'Discuss s grafem',
      goal: 'diskuse vidí mapu projektu',
      status: 'proposed',
    };

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('.mini/graph.json');
    expect(out).toContain('.mini/graph/');
    // graph se vkládá ne přímo do promptu — Claude si ho přečte sám
    expect(out).toContain('Stavím nástroj X pro Y.');
  });
});
