import { describe, expect, it } from 'vitest';
import { buildPhaseMemoryMarkdown, summarizeMemoryForNext } from './writeMemory.js';
import type { Phase } from '../state/types.js';

describe('buildPhaseMemoryMarkdown', () => {
  it('assembles the title, goal, steps with statuses, note and auto-commit', () => {
    const phase: Phase = {
      id: 17,
      title: 'Phase memory without the Claude API',
      goal: 'memory is generated in TS',
      status: 'done',
      steps: [
        { title: 'read the files', status: 'done' },
        { title: 'assemble the markdown', status: 'doing' },
        { title: 'something skipped', status: 'skipped' },
        { title: 'the rest', status: 'todo' },
      ],
      humanNotes: 'Claude only in the explicit mode.',
      autoCommit: { preSha: 'aaa', sha: 'bbb123', subject: 'Phase 17: memory in TS' },
    };

    const out = buildPhaseMemoryMarkdown(phase, '', '');

    expect(out).toContain('# Phase 17 — Phase memory without the Claude API');
    expect(out).toContain('**Goal:** memory is generated in TS');
    expect(out).toContain('- [done] read the files');
    expect(out).toContain('- [doing] assemble the markdown');
    expect(out).toContain('- [skipped] something skipped');
    expect(out).toContain('- [todo] the rest');
    expect(out).toContain("## User's note");
    expect(out).toContain('Claude only in the explicit mode.');
    expect(out).toContain('## Auto-commit');
    expect(out).toContain('- Phase 17: memory in TS (`bbb123`)');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('shows only the subject for an auto-commit without its own sha (new shape)', () => {
    const phase: Phase = {
      id: 70,
      title: 'Done commits all changes',
      status: 'done',
      // New phases store autoCommit without `sha` (the commit carries state.json with the record).
      autoCommit: { preSha: 'aaa', subject: 'Phase 70: Done commits all changes' },
    };

    const out = buildPhaseMemoryMarkdown(phase, '', '');

    expect(out).toContain('## Auto-commit');
    expect(out).toContain('- Phase 70: Done commits all changes');
    expect(out).not.toContain('`');
  });

  it('inserts the discuss and run content verbatim as sections', () => {
    const phase: Phase = { id: 3, title: 'Short', status: 'done' };

    const out = buildPhaseMemoryMarkdown(
      phase,
      '# Discussion of phase 3\nthe intent is such and such',
      '---\nphase: 3\nverdict: done\n---\nall done',
    );

    expect(out).toContain('## Discussion');
    expect(out).toContain('the intent is such and such');
    expect(out).toContain('## Run report');
    expect(out).toContain('all done');
  });

  it('omits optional sections when there is no data', () => {
    const phase: Phase = { id: 1, title: 'Bare phase', status: 'done' };

    const out = buildPhaseMemoryMarkdown(phase, '   ', '\n\n');

    expect(out).toContain('# Phase 1 — Bare phase');
    expect(out).toContain('**Goal:** (not specified)');
    expect(out).not.toContain('## Steps');
    expect(out).not.toContain("## User's note");
    expect(out).not.toContain('## Auto-commit');
    expect(out).not.toContain('## Discussion');
    expect(out).not.toContain('## Run report');
  });
});

describe('summarizeMemoryForNext', () => {
  // A representative full collage: head + Discussion (with Intent, Decisions and
  // Watch out for) + Run report (with a mechanical Verification and a Finding for the next phase).
  const phase: Phase = {
    id: 38,
    title: 'Command ranking by tokens',
    goal: 'measure the token cost of prompts',
    status: 'done',
    steps: [{ title: 'measuring core', status: 'done' }],
    humanNotes: 'a note from the user',
    autoCommit: { preSha: 'aaa', sha: 'cdd73ff', subject: 'Phase 38: ranking' },
  };
  const discuss = [
    '# Phase 38 — discussion',
    '## Intent',
    'measure token cost and sort the commands',
    '## Key decisions',
    'inserted context = sum of blocks',
    '## Watch out for',
    '- done has a branched template, watch out for the first run',
  ].join('\n');
  const run = [
    '---',
    'phase: 38',
    'verdict: done',
    '---',
    '# Phase 38 — report',
    '## What was done',
    'we wrote a token meter',
    '## Verification',
    'npm test green, 433 tests',
    '## Findings for next phase',
    'next is expensive due to the whole inserted last-memory (63%)',
  ].join('\n');
  const full = buildPhaseMemoryMarkdown(phase, discuss, run);

  it('keeps the phase head (header, goal, steps, note, auto-commit)', () => {
    const out = summarizeMemoryForNext(full);
    expect(out).toContain('# Phase 38 — Command ranking by tokens');
    expect(out).toContain('**Goal:** measure the token cost of prompts');
    expect(out).toContain('## Steps');
    expect(out).toContain('- [done] measuring core');
    expect(out).toContain("## User's note");
    expect(out).toContain('## Auto-commit');
    expect(out).toContain('cdd73ff');
  });

  it('extracts "Watch out for" from the discussion and "Findings for next phase" from the run report', () => {
    const out = summarizeMemoryForNext(full);
    expect(out).toContain('## Watch out for');
    expect(out).toContain('done has a branched template');
    expect(out).toContain('## Findings for next phase');
    expect(out).toContain('next is expensive due to the whole inserted last-memory');
  });

  it('drops Intent, Key decisions, the mechanical What was done / Verification and the block anchors', () => {
    const out = summarizeMemoryForNext(full);
    expect(out).not.toContain('## Intent');
    expect(out).not.toContain('measure token cost and sort');
    expect(out).not.toContain('## Key decisions');
    expect(out).not.toContain('inserted context = sum of blocks');
    expect(out).not.toContain('## What was done');
    expect(out).not.toContain('we wrote a token meter');
    expect(out).not.toContain('## Verification');
    expect(out).not.toContain('433 tests');
    expect(out).not.toContain('## Discussion');
    expect(out).not.toContain('## Run report');
  });

  it('is significantly shorter than the full collage', () => {
    const out = summarizeMemoryForNext(full);
    expect(out.length).toBeLessThan(full.length);
  });

  it('caps to the hard length limit without known anchors', () => {
    const long = Array.from({ length: 60 }, (_, i) => `line ${i} ${'x'.repeat(50)}`).join('\n');
    expect(long.length).toBeGreaterThan(2000);

    const out = summarizeMemoryForNext(long);

    expect(out).toContain('…(truncated)');
    expect(out.length).toBeLessThan(2100);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('returns short memory without anchors unchanged in content', () => {
    const out = summarizeMemoryForNext('# Phase 1 — Bare\n\n**Goal:** something');
    expect(out).toContain('# Phase 1 — Bare');
    expect(out).toContain('**Goal:** something');
    expect(out).not.toContain('…(truncated)');
  });

  it('still parses legacy Czech memory (## Diskuse + ## Pozor na anchors)', () => {
    // Memory written before the translation: Czech section headings. The consumer
    // must keep reading them via the legacy alias + the bilingual matchers.
    const legacy = [
      '# Fáze 12 — Stará fáze',
      '',
      '**Cíl:** něco starého',
      '',
      '## Diskuse',
      '## Záměr',
      'doslovný záměr k zahození',
      '## Pozor na',
      '- legacy pozor bod, který se má vytáhnout',
      '',
      '## Run report',
      '## Co se udělalo',
      'mechanický popis k zahození',
      '## Nález pro další fázi',
      'legacy nález k vytažení',
    ].join('\n');

    const out = summarizeMemoryForNext(legacy);

    // head stays
    expect(out).toContain('# Fáze 12 — Stará fáze');
    expect(out).toContain('**Cíl:** něco starého');
    // watch-out + finding sub-sections extracted
    expect(out).toContain('## Pozor na');
    expect(out).toContain('legacy pozor bod');
    expect(out).toContain('## Nález pro další fázi');
    expect(out).toContain('legacy nález k vytažení');
    // block anchors and verbatim intent/what-was-done dropped
    expect(out).not.toContain('## Diskuse');
    expect(out).not.toContain('doslovný záměr');
    expect(out).not.toContain('## Run report');
    expect(out).not.toContain('mechanický popis');
  });
});
