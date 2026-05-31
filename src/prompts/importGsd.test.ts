import { describe, expect, it } from 'vitest';
import { buildImportGsdPrompt } from './importGsd.js';

describe('buildImportGsdPrompt', () => {
  it('is deterministic', () => {
    expect(buildImportGsdPrompt()).toBe(buildImportGsdPrompt());
  });

  it('includes the strict output schema (NAME/WHAT/FOR_WHOM/CONSTRAINTS + PHASES)', () => {
    const out = buildImportGsdPrompt();

    expect(out).toContain('NAME: <project name>');
    expect(out).toContain('WHAT: <2-3 sentences');
    expect(out).toContain('FOR_WHOM: <for whom, or "-">');
    expect(out).toContain('CONSTRAINTS: <language/framework/constraints, or "-">');
    expect(out).toContain('PHASES:');
  });

  it('lists the four valid statuses and the mapping rules', () => {
    const out = buildImportGsdPrompt();

    expect(out).toContain('done, doing, todo, skipped');
    expect(out).toContain('completed, archived, finished');
    expect(out).toContain('in_progress, active');
    expect(out).toContain('pending, planned, proposed');
    expect(out).toContain('cancelled, canceled');
  });

  it('mentions typical GSD source paths', () => {
    const out = buildImportGsdPrompt();

    expect(out).toContain('.planning/PROJECT.md');
    expect(out).toContain('.planning/ROADMAP.md');
    expect(out).toContain('.planning/milestones/');
    expect(out).toContain('.planning/phases/');
  });

  it('matches the full snapshot', () => {
    expect(buildImportGsdPrompt()).toMatchSnapshot();
  });
});
