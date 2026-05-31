import { describe, expect, it } from 'vitest';
import { parseSteps } from './plan.js';

describe('parseSteps', () => {
  it('parses multiple STEP lines in order', () => {
    const text = 'STEP: init package\nSTEP: add commander\nSTEP: write help';
    expect(parseSteps(text)).toEqual(['init package', 'add commander', 'write help']);
  });

  it('trims whitespace around each step title', () => {
    const text = 'STEP:   first   \nSTEP:\tsecond\t';
    expect(parseSteps(text)).toEqual(['first', 'second']);
  });

  it('ignores lines that are not STEP markers', () => {
    const text = [
      'Here is my plan:',
      '',
      'STEP: step 1',
      'some note text',
      'STEP: step 2',
      '',
      'Done.',
    ].join('\n');
    expect(parseSteps(text)).toEqual(['step 1', 'step 2']);
  });

  it('returns empty array for empty input', () => {
    expect(parseSteps('')).toEqual([]);
  });

  it('returns empty array when no STEP marker is present', () => {
    expect(parseSteps('This is plain text without markers.\nAnother line.')).toEqual([]);
  });

  it('skips STEP lines whose value is empty after trim', () => {
    const text = 'STEP:    \nSTEP: a real step\nSTEP:';
    expect(parseSteps(text)).toEqual(['a real step']);
  });

  it('only matches markers at line start (case-sensitive)', () => {
    const text = '  STEP: indented step\nstep: lowercase\nSTEP: ok step';
    expect(parseSteps(text)).toEqual(['ok step']);
  });

  it('preserves duplicates (caller decides how to dedupe)', () => {
    const text = 'STEP: same\nSTEP: same\nSTEP: different';
    expect(parseSteps(text)).toEqual(['same', 'same', 'different']);
  });

  it('handles single-step happy path', () => {
    expect(parseSteps('STEP: just one step')).toEqual(['just one step']);
  });

});
