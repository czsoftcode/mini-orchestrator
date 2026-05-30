import { describe, expect, it } from 'vitest';
import {
  COMMAND_IDS,
  type RealInputs,
  estimateTokens,
  measureAll,
  rankMeasurements,
  renderConsole,
  renderReportMarkdown,
} from './measure.js';

// Fixní vstupy — záměrně NE reálný stav repa (ten se mění každou fází a dělal by
// snapshoty křehké). Velikosti bloků jsou různé, aby pořadí bylo jednoznačné.
const FIXED: RealInputs = {
  projectMd: 'P'.repeat(400),
  phases: [
    { id: 1, title: 'První fáze', status: 'done' },
    { id: 2, title: 'Druhá fáze', status: 'done' },
    { id: 3, title: 'Třetí fáze', status: 'doing' },
  ],
  phase: {
    id: 5,
    title: 'Pátá fáze',
    goal: 'Udělat něco užitečného a ověřitelného',
    status: 'doing',
    steps: [
      { title: 'Krok A', status: 'done' },
      { title: 'Krok B', status: 'todo' },
    ],
    humanNotes: 'Pozor na okrajové případy.',
  },
  lastMemoryMd: 'M'.repeat(300),
  discussNotes: 'D'.repeat(500),
  reportBody: 'R'.repeat(250),
  verify: [{ title: 'Zkontroluj UI', detail: 'vizuální dojem' }],
  focusedStep: { title: 'Krok B', status: 'todo' },
};

describe('estimateTokens', () => {
  it('je délka/4 zaokrouhlená nahoru', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('measureAll', () => {
  it('změří všech 7 příkazů', () => {
    const m = measureAll(FIXED);
    expect(m.map((x) => x.command).sort()).toEqual([...COMMAND_IDS].sort());
  });

  it('je deterministické', () => {
    expect(measureAll(FIXED)).toEqual(measureAll(FIXED));
  });

  it('vkládaný kontext = součet tokenů bloků', () => {
    for (const m of measureAll(FIXED)) {
      const blockSum = m.blocks.reduce((s, b) => s + b.tokens, 0);
      expect(m.injectedTokens).toBe(blockSum);
    }
  });

  it('reálný prompt = šablona + vkládaný kontext (a oba ≥ 0)', () => {
    for (const m of measureAll(FIXED)) {
      expect(m.templateTokens).toBeGreaterThanOrEqual(0);
      expect(m.realTokens).toBeGreaterThanOrEqual(m.injectedTokens);
      expect(m.templateTokens + m.injectedTokens).toBe(m.realTokens);
    }
  });
});

describe('rankMeasurements', () => {
  it('řadí sestupně podle reálných tokenů', () => {
    const ranked = rankMeasurements(measureAll(FIXED));
    for (let i = 1; i < ranked.length; i++) {
      const prev = ranked[i - 1]!;
      const cur = ranked[i]!;
      expect(prev.realTokens).toBeGreaterThanOrEqual(cur.realTokens);
    }
  });
});

describe('render', () => {
  it('markdown report nad fixními vstupy (snapshot)', () => {
    expect(renderReportMarkdown(rankMeasurements(measureAll(FIXED)))).toMatchSnapshot();
  });

  it('konzolový výpis nad fixními vstupy (snapshot)', () => {
    expect(renderConsole(rankMeasurements(measureAll(FIXED)))).toMatchSnapshot();
  });
});
