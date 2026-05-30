import { describe, expect, it } from 'vitest';
import { buildPhaseMemoryMarkdown, summarizeMemoryForNext } from './writeMemory.js';
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

describe('summarizeMemoryForNext', () => {
  // Reprezentativní plná koláž: hlava + Diskuse (se Záměrem, Rozhodnutími a
  // Pozor na) + Run report (s mechanickým Ověřením a Nálezem pro další fázi).
  const phase: Phase = {
    id: 38,
    title: 'Žebříček příkazů podle tokenů',
    goal: 'změřit token cenu promptů',
    status: 'done',
    steps: [{ title: 'měřicí jádro', status: 'done' }],
    humanNotes: 'poznámka od uživatele',
    autoCommit: { preSha: 'aaa', sha: 'cdd73ff', subject: 'Fáze 38: žebříček' },
  };
  const discuss = [
    '# Fáze 38 — diskuse',
    '## Záměr',
    'změřit token cenu a seřadit příkazy',
    '## Klíčová rozhodnutí',
    'vkládaný kontext = součet bloků',
    '## Pozor na',
    '- done má větvenou šablonu, pozor na první běh',
  ].join('\n');
  const run = [
    '---',
    'phase: 38',
    'verdict: done',
    '---',
    '# Fáze 38 — report',
    '## Co se udělalo',
    'napsali jsme měřič tokenů',
    '## Ověření (strojově)',
    'npm test zelené, 433 testů',
    '## Nález pro další fázi',
    'next je drahý kvůli celé vložené last-memory (63 %)',
  ].join('\n');
  const full = buildPhaseMemoryMarkdown(phase, discuss, run);

  it('ponechá hlavu fáze (hlavička, cíl, kroky, poznámka, auto-commit)', () => {
    const out = summarizeMemoryForNext(full);
    expect(out).toContain('# Fáze 38 — Žebříček příkazů podle tokenů');
    expect(out).toContain('**Cíl:** změřit token cenu promptů');
    expect(out).toContain('## Kroky');
    expect(out).toContain('- [hotovo] měřicí jádro');
    expect(out).toContain('## Poznámka uživatele');
    expect(out).toContain('## Auto-commit');
    expect(out).toContain('cdd73ff');
  });

  it('vytáhne „Pozor na" z diskuse a „Nález pro další fázi" z run reportu', () => {
    const out = summarizeMemoryForNext(full);
    expect(out).toContain('## Pozor na');
    expect(out).toContain('done má větvenou šablonu');
    expect(out).toContain('## Nález pro další fázi');
    expect(out).toContain('next je drahý kvůli celé vložené last-memory');
  });

  it('zahodí Záměr, Klíčová rozhodnutí, mechanické Co se udělalo / Ověření i kotvy bloků', () => {
    const out = summarizeMemoryForNext(full);
    expect(out).not.toContain('## Záměr');
    expect(out).not.toContain('změřit token cenu a seřadit');
    expect(out).not.toContain('## Klíčová rozhodnutí');
    expect(out).not.toContain('vkládaný kontext = součet bloků');
    expect(out).not.toContain('## Co se udělalo');
    expect(out).not.toContain('napsali jsme měřič');
    expect(out).not.toContain('## Ověření');
    expect(out).not.toContain('433 testů');
    expect(out).not.toContain('## Diskuse');
    expect(out).not.toContain('## Run report');
  });

  it('je výrazně kratší než plná koláž', () => {
    const out = summarizeMemoryForNext(full);
    expect(out.length).toBeLessThan(full.length);
  });

  it('bez známých kotev ořízne na tvrdý limit délky', () => {
    const long = Array.from({ length: 60 }, (_, i) => `řádek ${i} ${'x'.repeat(50)}`).join('\n');
    expect(long.length).toBeGreaterThan(2000);

    const out = summarizeMemoryForNext(long);

    expect(out).toContain('…(zkráceno)');
    expect(out.length).toBeLessThan(2100);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('krátkou paměť bez kotev vrátí beze změny obsahu', () => {
    const out = summarizeMemoryForNext('# Fáze 1 — Holá\n\n**Cíl:** něco');
    expect(out).toContain('# Fáze 1 — Holá');
    expect(out).toContain('**Cíl:** něco');
    expect(out).not.toContain('…(zkráceno)');
  });
});
