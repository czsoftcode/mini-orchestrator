import { describe, expect, it } from 'vitest';
import { buildPhaseMemoryMarkdown } from './writeMemory.js';
import type { Phase } from '../state/types.js';

describe('buildPhaseMemoryMarkdown', () => {
  it('složí title, cíl, kroky se statusy, poznámku a auto-commit', () => {
    const phase: Phase = {
      id: 17,
      title: 'Paměť fáze bez Claude API',
      goal: 'memory se generuje v TS',
      status: 'done',
      steps: [
        { title: 'přečíst soubory', status: 'done' },
        { title: 'sestavit markdown', status: 'doing' },
        { title: 'něco odloženého', status: 'skipped' },
        { title: 'zbytek', status: 'todo' },
      ],
      humanNotes: 'Claude jen v explicitním režimu.',
      autoCommit: { preSha: 'aaa', sha: 'bbb123', subject: 'Fáze 17: paměť v TS' },
    };

    const out = buildPhaseMemoryMarkdown(phase, '', '');

    expect(out).toContain('# Fáze 17 — Paměť fáze bez Claude API');
    expect(out).toContain('**Cíl:** memory se generuje v TS');
    expect(out).toContain('- [hotovo] přečíst soubory');
    expect(out).toContain('- [dělá se] sestavit markdown');
    expect(out).toContain('- [odloženo] něco odloženého');
    expect(out).toContain('- [čeká] zbytek');
    expect(out).toContain('## Poznámka uživatele');
    expect(out).toContain('Claude jen v explicitním režimu.');
    expect(out).toContain('## Auto-commit');
    expect(out).toContain('- Fáze 17: paměť v TS (`bbb123`)');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('vloží discuss a run obsah doslova jako sekce', () => {
    const phase: Phase = { id: 3, title: 'Krátká', status: 'done' };

    const out = buildPhaseMemoryMarkdown(
      phase,
      '# Diskuse fáze 3\nzáměr je takový a makový',
      '---\nphase: 3\nverdict: done\n---\nvše hotovo',
    );

    expect(out).toContain('## Diskuse');
    expect(out).toContain('záměr je takový a makový');
    expect(out).toContain('## Run report');
    expect(out).toContain('vše hotovo');
  });

  it('vynechá volitelné sekce, když nejsou data', () => {
    const phase: Phase = { id: 1, title: 'Holá fáze', status: 'done' };

    const out = buildPhaseMemoryMarkdown(phase, '   ', '\n\n');

    expect(out).toContain('# Fáze 1 — Holá fáze');
    expect(out).toContain('**Cíl:** (nezadán)');
    expect(out).not.toContain('## Kroky');
    expect(out).not.toContain('## Poznámka uživatele');
    expect(out).not.toContain('## Auto-commit');
    expect(out).not.toContain('## Diskuse');
    expect(out).not.toContain('## Run report');
  });
});
