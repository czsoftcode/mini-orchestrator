import { describe, expect, it } from 'vitest';
import { parseSuggestion } from './next.js';

describe('parseSuggestion', () => {
  it('parses TITLE + GOAL on consecutive lines', () => {
    const out = parseSuggestion('TITLE: Bootstrap CLI\nGOAL: mini --version vypíše verzi');
    expect(out).toEqual({ title: 'Bootstrap CLI', goal: 'mini --version vypíše verzi' });
  });

  it('trims surrounding whitespace from values', () => {
    const out = parseSuggestion('TITLE:    Stav v JSON   \nGOAL:   atomické zapsání   ');
    expect(out).toEqual({ title: 'Stav v JSON', goal: 'atomické zapsání' });
  });

  it('ignores surrounding prose around the markers', () => {
    const text = [
      'Tady je můj návrh:',
      '',
      'TITLE: Testy parserů',
      'GOAL: parsery jsou pokryté testy',
      '',
      'Hotovo, čekám na zpětnou vazbu.',
    ].join('\n');
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'Testy parserů', goal: 'parsery jsou pokryté testy' });
  });

  it('accepts the "-" sentinel as the title (signals project done)', () => {
    const out = parseSuggestion('TITLE: -\nGOAL: -');
    expect(out).toEqual({ title: '-', goal: '-' });
  });

  it('matches markers anywhere in the text (multiline mode)', () => {
    const text = 'random first line\nTITLE: Snapshot testy\nrandom middle\nGOAL: kryté snapshoty';
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'Snapshot testy', goal: 'kryté snapshoty' });
  });

  it('returns null when input is empty', () => {
    expect(parseSuggestion('')).toBeNull();
  });

  it('returns null when only TITLE is present', () => {
    expect(parseSuggestion('TITLE: Refactor')).toBeNull();
  });

  it('returns null when only GOAL is present', () => {
    expect(parseSuggestion('GOAL: udělat něco')).toBeNull();
  });

  it('returns null when TITLE value is empty after trim', () => {
    expect(parseSuggestion('TITLE:    \nGOAL: nějaký cíl')).toBeNull();
  });

  it('returns null when markers are not at line start', () => {
    expect(parseSuggestion('foo TITLE: bar\nbaz GOAL: qux')).toBeNull();
  });

  it('returns null on garbage input', () => {
    expect(parseSuggestion('Tohle je naprosto jiná odpověď bez markerů.')).toBeNull();
  });

  it('picks the first occurrence when markers are repeated', () => {
    const text = 'TITLE: První\nGOAL: cíl A\nTITLE: Druhý\nGOAL: cíl B';
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'První', goal: 'cíl A' });
  });
});
