import { describe, expect, it } from 'vitest';
import { parseSteps } from './plan.js';

describe('parseSteps', () => {
  it('parses multiple STEP lines in order', () => {
    const text = 'STEP: init package\nSTEP: přidat commander\nSTEP: napsat help';
    expect(parseSteps(text)).toEqual(['init package', 'přidat commander', 'napsat help']);
  });

  it('trims whitespace around each step title', () => {
    const text = 'STEP:   první   \nSTEP:\tdruhý\t';
    expect(parseSteps(text)).toEqual(['první', 'druhý']);
  });

  it('ignores lines that are not STEP markers', () => {
    const text = [
      'Tady je můj plán:',
      '',
      'STEP: krok 1',
      'nějaký poznámkový text',
      'STEP: krok 2',
      '',
      'Hotovo.',
    ].join('\n');
    expect(parseSteps(text)).toEqual(['krok 1', 'krok 2']);
  });

  it('returns empty array for empty input', () => {
    expect(parseSteps('')).toEqual([]);
  });

  it('returns empty array when no STEP marker is present', () => {
    expect(parseSteps('Tohle je obyčejný text bez markerů.\nDalší řádek.')).toEqual([]);
  });

  it('skips STEP lines whose value is empty after trim', () => {
    const text = 'STEP:    \nSTEP: opravdový krok\nSTEP:';
    expect(parseSteps(text)).toEqual(['opravdový krok']);
  });

  it('only matches markers at line start (case-sensitive)', () => {
    const text = '  STEP: odsazený krok\nstep: malá písmena\nSTEP: ok krok';
    expect(parseSteps(text)).toEqual(['ok krok']);
  });

  it('preserves duplicates (caller decides how to dedupe)', () => {
    const text = 'STEP: stejný\nSTEP: stejný\nSTEP: jiný';
    expect(parseSteps(text)).toEqual(['stejný', 'stejný', 'jiný']);
  });

  it('handles single-step happy path', () => {
    expect(parseSteps('STEP: jen jeden krok')).toEqual(['jen jeden krok']);
  });

});
