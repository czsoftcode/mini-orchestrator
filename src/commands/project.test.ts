import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exists, newState, readProject, save, statePath } from '../state/store.js';
import { applyProject, parseProjectContract } from './project.js';

describe('parseProjectContract', () => {
  it('keeps multi-line bullet sections intact', () => {
    const text = `NAME: Demo
WHAT: A small thing.
FOR_WHOM: developers
CONSTRAINTS: TypeScript
APPROACH:
- start simple
- iterate
NON_GOALS:
- no GUI
SUCCESS:
- tests pass
- users happy`;
    const parsed = parseProjectContract(text);
    expect(parsed).toEqual({
      name: 'Demo',
      what: 'A small thing.',
      forWhom: 'developers',
      constraints: 'TypeScript',
      approach: '- start simple\n- iterate',
      nonGoals: '- no GUI',
      success: '- tests pass\n- users happy',
    });
  });

  it('omits empty optional fields', () => {
    const text = `NAME: P
WHAT: w
FOR_WHOM: x
CONSTRAINTS: y`;
    const parsed = parseProjectContract(text);
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('approach');
    expect(parsed).not.toHaveProperty('nonGoals');
    expect(parsed).not.toHaveProperty('success');
  });

  it('omits an optional field whose body is present but empty', () => {
    const text = `NAME: P
WHAT: w
APPROACH:
SUCCESS: -`;
    const parsed = parseProjectContract(text);
    expect(parsed).not.toHaveProperty('approach');
    expect(parsed).not.toHaveProperty('success');
  });

  it('treats a label-like string NOT at column 0 as content', () => {
    const text = `NAME: P
WHAT: w
APPROACH:
- mind the SUCCESS: criteria
  CONSTRAINTS: are indented here`;
    const parsed = parseProjectContract(text);
    // The indented / mid-line label-likes stay inside APPROACH, they do not
    // start CONSTRAINTS or SUCCESS sections.
    expect(parsed?.approach).toBe('- mind the SUCCESS: criteria\n  CONSTRAINTS: are indented here');
    expect(parsed).not.toHaveProperty('success');
    expect(parsed?.constraints).toBe('');
  });

  it('returns null when NAME is missing', () => {
    expect(parseProjectContract('WHAT: only what')).toBeNull();
  });

  it('returns null when WHAT is missing', () => {
    expect(parseProjectContract('NAME: only name')).toBeNull();
  });

  it('treats a lone "-" value as empty', () => {
    const parsed = parseProjectContract(`NAME: P
WHAT: w
FOR_WHOM: -
CONSTRAINTS: -`);
    expect(parsed?.forWhom).toBe('');
    expect(parsed?.constraints).toBe('');
  });

  it('ignores text before the first label', () => {
    const parsed = parseProjectContract(`Here is the contract you asked for:

NAME: P
WHAT: w`);
    expect(parsed?.name).toBe('P');
    expect(parsed?.what).toBe('w');
  });
});

describe('applyProject', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-project-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('renders the new sections and keeps the "## What I\'m building" heading', async () => {
    await save(newState(), cwd);
    const res = await applyProject(
      {
        name: 'Demo',
        what: 'A small thing.',
        forWhom: 'developers',
        constraints: 'TypeScript',
        approach: '- start simple',
        nonGoals: '- no GUI',
        success: '- tests pass',
      },
      cwd,
    );
    expect(res).toEqual({ ok: true });

    const md = await readProject(cwd);
    expect(md).toContain('# Demo');
    expect(md).toContain("## What I'm building"); // status.ts depends on this heading
    expect(md).toContain('## Approach\n- start simple');
    expect(md).toContain('## Non-goals\n- no GUI');
    expect(md).toContain('## Success criteria\n- tests pass');
    // Main constraints stays last.
    expect(md.trimEnd().endsWith('## Main constraints\nTypeScript')).toBe(true);
  });

  it('resolves placeholders for empty forWhom/constraints', async () => {
    await save(newState(), cwd);
    await applyProject({ name: 'P', what: 'w', forWhom: '', constraints: '' }, cwd);
    const md = await readProject(cwd);
    expect(md).toContain('(not specified)');
    expect(md).toContain('(none)');
  });

  it('errors and writes nothing without an existing project', async () => {
    const res = await applyProject({ name: 'P', what: 'w', forWhom: '', constraints: '' }, cwd);
    expect(res).toEqual({ ok: false, reason: 'no-project' });
    expect(await exists(cwd)).toBe(false);
  });

  it('never touches state.json', async () => {
    const seeded = newState();
    seeded.models = { default: 'opus' };
    await save(seeded, cwd);
    const before = await readFile(statePath(cwd), 'utf8');

    await applyProject({ name: 'P', what: 'w', forWhom: 'x', constraints: 'y' }, cwd);

    const after = await readFile(statePath(cwd), 'utf8');
    expect(after).toBe(before);
  });
});
