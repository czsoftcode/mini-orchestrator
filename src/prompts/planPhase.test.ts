import { describe, expect, it } from 'vitest';
import { buildPlanPhasePrompt } from './planPhase.js';
import type { Phase } from '../state/types.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

describe('buildPlanPhasePrompt', () => {
  it('renders phase with explicit goal', () => {
    const phase: Phase = {
      id: 2,
      title: 'Snapshot testy',
      goal: 'src/prompts/*.ts mají snapshot testy a npm test prochází',
      status: 'planned',
    };

    const out = buildPlanPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('**Fáze 2: Snapshot testy**');
    expect(out).toContain(
      'Cíl: src/prompts/*.ts mají snapshot testy a npm test prochází',
    );
    expect(out).toContain('STEP: <stručný popis kroku, max 8 slov>');
    expect(out).not.toContain('(nezadán)');
    expect(out).toMatchSnapshot();
  });

  it('falls back to (nezadán) when phase has no goal', () => {
    const phase: Phase = {
      id: 7,
      title: 'Refactor CLI',
      status: 'proposed',
    };

    const out = buildPlanPhasePrompt(PROJECT_MD, phase);

    expect(out).toContain('**Fáze 7: Refactor CLI**');
    expect(out).toContain('Cíl: (nezadán)');
    expect(out).toMatchSnapshot();
  });

  it('trims projectMd whitespace', () => {
    const phase: Phase = { id: 1, title: 'P1', status: 'planned' };
    const out = buildPlanPhasePrompt(`\n\n  ${PROJECT_MD}  \n\n`, phase);

    expect(out).toContain(`# Projekt\n${PROJECT_MD}\n`);
    expect(out).not.toContain('# Projekt\n\n');
  });

  it('inserts discuss notes block when notes are provided', () => {
    const phase: Phase = {
      id: 8,
      title: 'Poznámky z diskuze',
      goal: 'plan a do čtou notes',
      status: 'planned',
    };
    const notes = `# Fáze 8 — Poznámky z diskuze

## Záměr
shrnout diskusi do souboru

## Klíčová rozhodnutí
- soubor je markdown bez schématu`;

    const out = buildPlanPhasePrompt(PROJECT_MD, phase, notes);

    expect(out).toContain('# Poznámky k fázi (z diskuse)');
    expect(out).toContain('## Klíčová rozhodnutí');
    expect(out).toContain('shrnout diskusi do souboru');
    expect(out).toMatchSnapshot();
  });

  it('omits notes block when notes are null, undefined or blank', () => {
    const phase: Phase = { id: 1, title: 'P1', status: 'planned' };

    const noNotes = buildPlanPhasePrompt(PROJECT_MD, phase);
    const nullNotes = buildPlanPhasePrompt(PROJECT_MD, phase, null);
    const blankNotes = buildPlanPhasePrompt(PROJECT_MD, phase, '   \n  \n');

    expect(noNotes).not.toContain('# Poznámky k fázi (z diskuse)');
    expect(nullNotes).not.toContain('# Poznámky k fázi (z diskuse)');
    expect(blankNotes).not.toContain('# Poznámky k fázi (z diskuse)');
    expect(nullNotes).toBe(noNotes);
    expect(blankNotes).toBe(noNotes);
  });
});
