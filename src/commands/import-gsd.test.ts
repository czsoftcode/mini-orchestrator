import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exists, load, newState, readProject, save } from '../state/store.js';
import { applyImport } from './import-gsd.js';

let cwd: string;

const VALID = `NAME: Demo Project
WHAT: Builds a small thing for a small audience.
FOR_WHOM: developers
CONSTRAINTS: TypeScript

PHASES:
1 | done | Setup
2 | doing | Core feature
3 | todo | Polish
`;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-import-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('applyImport', () => {
  it('parses the contract and saves the project + phases, preserving statuses', async () => {
    const res = await applyImport(VALID, { cwd });
    expect(res.ok).toBe(true);
    expect(await exists(cwd)).toBe(true);

    const state = await load(cwd);
    expect(state.phases.map((p) => [p.id, p.status, p.title])).toEqual([
      [1, 'done', 'Setup'],
      [2, 'doing', 'Core feature'],
      [3, 'proposed', 'Polish'],
    ]);
    // The current phase points at the first doing phase.
    expect(state.currentPhaseId).toBe(2);

    const projectMd = await readProject(cwd);
    expect(projectMd).toContain('# Demo Project');
    expect(projectMd).toContain('developers');
    expect(projectMd).toContain('TypeScript');
  });

  it('points currentPhaseId at the first proposed phase when none is doing', async () => {
    const text = `NAME: P
WHAT: w
FOR_WHOM: -
CONSTRAINTS: -

PHASES:
1 | done | A
2 | todo | B
`;
    const res = await applyImport(text, { cwd });
    expect(res.ok).toBe(true);
    const state = await load(cwd);
    expect(state.currentPhaseId).toBe(2);
    // "-" placeholders become empty in project.md.
    const projectMd = await readProject(cwd);
    expect(projectMd).toContain('(not specified)');
    expect(projectMd).toContain('(none)');
  });

  it('refuses to overwrite an existing project without --force', async () => {
    await save(newState(), cwd);
    const res = await applyImport(VALID, { cwd });
    expect(res).toEqual({ ok: false, reason: 'exists' });
    // The original (empty) project is untouched.
    expect((await load(cwd)).phases).toEqual([]);
  });

  it('overwrites with --force and preserves the existing model config', async () => {
    const seeded = newState();
    seeded.models = { default: 'opus', do: 'sonnet' };
    await save(seeded, cwd);

    const res = await applyImport(VALID, { cwd, force: true });
    expect(res.ok).toBe(true);

    const state = await load(cwd);
    expect(state.phases).toHaveLength(3);
    expect(state.models).toEqual({ default: 'opus', do: 'sonnet' });
  });

  it('rejects an unreadable response and writes nothing', async () => {
    const res = await applyImport('not the contract at all', { cwd });
    expect(res).toEqual({ ok: false, reason: 'parse' });
    expect(await exists(cwd)).toBe(false);
  });
});
