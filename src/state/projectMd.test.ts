import { describe, expect, it } from 'vitest';
import { renderProjectMd } from './projectMd.js';

describe('renderProjectMd', () => {
  it('renders the required-only layout byte-for-byte like the legacy renderer', () => {
    const out = renderProjectMd({
      name: 'Demo',
      what: 'A thing',
      forWhom: 'Developers',
      constraints: 'TypeScript',
    });

    expect(out).toBe(
      `# Demo

## What I'm building
A thing

## Who it's for
Developers

## Main constraints
TypeScript
`,
    );
  });

  it('passes empty values through verbatim (no internal fallback substitution)', () => {
    const out = renderProjectMd({
      name: 'Demo',
      what: 'A thing',
      forWhom: '',
      constraints: '',
    });

    // The renderer does NOT inject "(none)"/"(not specified)" — that is the
    // caller's job. Empty fields render as empty lines.
    expect(out).not.toContain('(none)');
    expect(out).not.toContain('(not specified)');
    expect(out).toBe(
      `# Demo

## What I'm building
A thing

## Who it's for


## Main constraints

`,
    );
  });

  it('renders optional sections in order between Who it\'s for and Main constraints', () => {
    const out = renderProjectMd({
      name: 'Demo',
      what: 'A thing',
      forWhom: 'Developers',
      constraints: 'TypeScript',
      approach: 'Iterate in small phases',
      nonGoals: 'No GUI',
      success: 'All tests green',
    });

    expect(out).toBe(
      `# Demo

## What I'm building
A thing

## Who it's for
Developers

## Approach
Iterate in small phases

## Non-goals
No GUI

## Success criteria
All tests green

## Main constraints
TypeScript
`,
    );
  });

  it('drops optional sections whose value is empty or omitted', () => {
    const out = renderProjectMd({
      name: 'Demo',
      what: 'A thing',
      forWhom: 'Developers',
      constraints: 'TypeScript',
      approach: 'Only this one',
      nonGoals: '',
    });

    expect(out).toContain('## Approach\nOnly this one');
    expect(out).not.toContain('## Non-goals');
    expect(out).not.toContain('## Success criteria');
  });

  it('keeps Main constraints last even when optional sections are present', () => {
    const out = renderProjectMd({
      name: 'Demo',
      what: 'A thing',
      forWhom: 'Developers',
      constraints: 'TypeScript',
      approach: 'A',
      nonGoals: 'B',
      success: 'C',
    });

    expect(out.lastIndexOf('## Main constraints')).toBeGreaterThan(out.indexOf('## Success criteria'));
    expect(out.trimEnd().endsWith('TypeScript')).toBe(true);
  });
});
