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

    expect(out).toContain('**Fáze 3: Diskusní session**');
    expect(out).toContain('Cíl: uživatel může prodiskutovat fázi před plánováním');
    expect(out).not.toContain('(nezadán)');
    expect(out).toContain('NEIMPLEMENTUJ');
    expect(out).toMatchSnapshot();
  });

  it('falls back to (nezadán) when phase has no goal', () => {
    const phase: Phase = {
      id: 5,
      title: 'Refactor auth',
      status: 'proposed',
    };

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('**Fáze 5: Refactor auth**');
    expect(out).toContain('Cíl: (nezadán)');
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

    expect(out).toContain('- [hotovo] připravit schéma');
    expect(out).toContain('- [čeká] napsat handler');
    expect(out).toContain('- [odloženo] starý nápad');
    expect(out).not.toContain('← pracuj na tomhle');
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

    expect(out).not.toContain('Kroky:');
    expect(out).toMatchSnapshot();
  });

  it('trims projectMd whitespace', () => {
    const phase: Phase = { id: 1, title: 'P1', status: 'proposed' };
    const out = buildDiscussPhasePrompt(`\n\n  ${PROJECT_MD}  \n\n`, phase);

    expect(out).toContain(`# Projekt\n${PROJECT_MD}\n`);
    expect(out).not.toContain('# Projekt\n\n');
  });

  it('uses graphMd instead of projectMd when provided', () => {
    const phase: Phase = {
      id: 8,
      title: 'Discuss s grafem',
      goal: 'diskuse vidí mapu projektu',
      status: 'proposed',
    };
    const graphMd = '# Graf projektu\n\n## src/a.ts\n\nExports:\n- function a(): number\n';

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase, { graphMd });

    expect(out).toContain('# Graf projektu');
    expect(out).toContain('## src/a.ts');
    expect(out).toContain('function a(): number');
    expect(out).not.toContain('Stavím nástroj X pro Y.');
    expect(out).toMatchSnapshot();
  });

  it('falls back to projectMd when graphMd is empty or whitespace', () => {
    const phase: Phase = { id: 9, title: 'P9', goal: 'g', status: 'proposed' };

    const out1 = buildDiscussPhasePrompt(PROJECT_MD, phase, { graphMd: '' });
    const out2 = buildDiscussPhasePrompt(PROJECT_MD, phase, { graphMd: '   \n  ' });

    expect(out1).toContain('Stavím nástroj X pro Y.');
    expect(out1).not.toContain('# Graf projektu');
    expect(out2).toContain('Stavím nástroj X pro Y.');
    expect(out2).not.toContain('# Graf projektu');
  });

  it('trims graphMd whitespace', () => {
    const phase: Phase = { id: 10, title: 'P10', status: 'proposed' };
    const graphMd = '# Graf projektu\n\n## src/x.ts\n';

    const out = buildDiscussPhasePrompt(PROJECT_MD, phase, {
      graphMd: `\n\n  ${graphMd}  \n\n`,
    });

    expect(out).toContain(`# Projekt\n${graphMd}\n`);
    expect(out).not.toContain('# Projekt\n\n');
  });
});
