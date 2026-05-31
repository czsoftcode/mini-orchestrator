import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { next, parseSuggestion } from './next.js';
import { askClaude } from '../claude/ask.js';
import { load, save, writeProject } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';

// We replace the Claude session — auto next just requests a phase suggestion.
vi.mock('../claude/ask.js', () => ({
  askClaude: vi.fn(),
}));

const askClaudeMock = vi.mocked(askClaude);

function makeState(phases: Phase[], currentPhaseId: number | null): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId,
    phases,
  };
}

describe('parseSuggestion', () => {
  it('parses TITLE + GOAL on consecutive lines', () => {
    const out = parseSuggestion('TITLE: Bootstrap CLI\nGOAL: mini --version prints the version');
    expect(out).toEqual({ title: 'Bootstrap CLI', goal: 'mini --version prints the version' });
  });

  it('trims surrounding whitespace from values', () => {
    const out = parseSuggestion('TITLE:    State in JSON   \nGOAL:   atomic write   ');
    expect(out).toEqual({ title: 'State in JSON', goal: 'atomic write' });
  });

  it('ignores surrounding prose around the markers', () => {
    const text = [
      'Here is my suggestion:',
      '',
      'TITLE: Parser tests',
      'GOAL: the parsers are covered by tests',
      '',
      'Done, waiting for feedback.',
    ].join('\n');
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'Parser tests', goal: 'the parsers are covered by tests' });
  });

  it('accepts the "-" sentinel as the title (signals project done)', () => {
    const out = parseSuggestion('TITLE: -\nGOAL: -');
    expect(out).toEqual({ title: '-', goal: '-' });
  });

  it('matches markers anywhere in the text (multiline mode)', () => {
    const text = 'random first line\nTITLE: Snapshot tests\nrandom middle\nGOAL: covered snapshots';
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'Snapshot tests', goal: 'covered snapshots' });
  });

  it('returns null when input is empty', () => {
    expect(parseSuggestion('')).toBeNull();
  });

  it('returns null when only TITLE is present', () => {
    expect(parseSuggestion('TITLE: Refactor')).toBeNull();
  });

  it('returns null when only GOAL is present', () => {
    expect(parseSuggestion('GOAL: do something')).toBeNull();
  });

  it('returns null when TITLE value is empty after trim', () => {
    expect(parseSuggestion('TITLE:    \nGOAL: some goal')).toBeNull();
  });

  it('returns null when markers are not at line start', () => {
    expect(parseSuggestion('foo TITLE: bar\nbaz GOAL: qux')).toBeNull();
  });

  it('returns null on garbage input', () => {
    expect(parseSuggestion('This is a completely different answer without markers.')).toBeNull();
  });

  it('picks the first occurrence when markers are repeated', () => {
    const text = 'TITLE: First\nGOAL: goal A\nTITLE: Second\nGOAL: goal B';
    const out = parseSuggestion(text);
    expect(out).toEqual({ title: 'First', goal: 'goal A' });
  });

  // --- tolerance to small format deviations (R4) -------------------------

  it('tolerates markdown bold around the marker and the value', () => {
    const out = parseSuggestion('**TITLE:** **Bootstrap CLI**\n**GOAL:** mini works');
    expect(out).toEqual({ title: 'Bootstrap CLI', goal: 'mini works' });
  });

  it('tolerates lowercase markers', () => {
    const out = parseSuggestion('title: State in JSON\ngoal: atomic write');
    expect(out).toEqual({ title: 'State in JSON', goal: 'atomic write' });
  });

  it('tolerates leading markdown decoration (#, -, >) before the marker', () => {
    const out = parseSuggestion('# TITLE: Heading phase\n- GOAL: done when the build passes');
    expect(out).toEqual({ title: 'Heading phase', goal: 'done when the build passes' });
  });

  it('tolerates a missing space after the colon', () => {
    const out = parseSuggestion('TITLE:Compact\nGOAL:no space');
    expect(out).toEqual({ title: 'Compact', goal: 'no space' });
  });
});

describe('next({ auto: true }) — phase numbering (W2)', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-next-auto-'));
    process.chdir(cwd);
    askClaudeMock.mockReset();
    askClaudeMock.mockResolvedValue({
      text: 'TITLE: New phase\nGOAL: something done',
    });
    await writeProject('# Project', cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('assigns a whole ID even when a fix sub-phase exists in the state (21.1)', async () => {
    await save(
      makeState(
        [
          { id: 21, title: 'Parent', status: 'done' },
          { id: 21.1, title: 'Fix', status: 'done', steps: [] },
        ],
        null,
      ),
      cwd,
    );

    const r = await next({ auto: true });

    expect(r.ok).toBe(true);
    const loaded = await load(cwd);
    const ids = loaded.phases.map((p) => p.id);
    // The new phase must be 22, not 22.1 (Math.floor drops the fractional part of 21.1).
    expect(ids).toContain(22);
    expect(ids.some((id) => id === 22.1)).toBe(false);
  });
});

describe('next({ auto: true }) — retry on an unparseable response (R4)', () => {
  let cwd: string;
  let prevCwd: string;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-next-retry-'));
    process.chdir(cwd);
    askClaudeMock.mockReset();
    await writeProject('# Project', cwd);
    await save(makeState([], null), cwd);
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('after an unreadable first response tries a second time and succeeds', async () => {
    askClaudeMock
      .mockResolvedValueOnce({ text: 'Here is some reasoning without markers.' })
      .mockResolvedValueOnce({ text: 'TITLE: Second attempt\nGOAL: readable this time' });

    const r = await next({ auto: true });

    expect(r.ok).toBe(true);
    expect(askClaudeMock).toHaveBeenCalledTimes(2);
    const loaded = await load(cwd);
    expect(loaded.phases).toHaveLength(1);
    expect(loaded.phases[0]?.title).toBe('Second attempt');
    expect(loaded.phases[0]?.goal).toBe('readable this time');
  });

  it('the retry gets a format addendum in the prompt', async () => {
    askClaudeMock
      .mockResolvedValueOnce({ text: 'without markers' })
      .mockResolvedValueOnce({ text: 'TITLE: OK\nGOAL: done' });

    await next({ auto: true });

    const secondPrompt = askClaudeMock.mock.calls[1]![0] as string;
    expect(secondPrompt).toContain('TITLE:');
    expect(secondPrompt).toContain('could not be read');
  });

  it('after two unreadable responses gives up with parse-failed (only one retry)', async () => {
    askClaudeMock
      .mockResolvedValueOnce({ text: 'still nothing' })
      .mockResolvedValueOnce({ text: 'nothing again' });

    const r = await next({ auto: true });

    expect(r).toEqual({ ok: false, reason: 'parse-failed' });
    expect(askClaudeMock).toHaveBeenCalledTimes(2);
    const loaded = await load(cwd);
    expect(loaded.phases).toHaveLength(0);
  });
});
