import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { save } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';
import { resolveSecurityTarget } from './securityTarget.js';

const execFileAsync = promisify(execFile);

async function initRepo(cwd: string): Promise<void> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'mini-test@example.com'], { cwd });
  await execFileAsync('git', ['config', 'user.name', 'Mini Test'], { cwd });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
}

/** Creates a commit touching a uniquely named file and returns its full SHA. */
async function commit(cwd: string, name: string): Promise<string> {
  await writeFile(join(cwd, name), `${name}\n`);
  await execFileAsync('git', ['add', '-A'], { cwd });
  await execFileAsync('git', ['commit', '-m', name], { cwd });
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd });
  return stdout.trim();
}

function donePhase(id: number, preSha?: string): Phase {
  const phase: Phase = { id, title: `P${id}`, status: 'done' };
  if (preSha) phase.autoCommit = { preSha, subject: `Phase ${id}` };
  return phase;
}

function stateOf(phases: Phase[]): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases,
  };
}

describe('resolveSecurityTarget', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-sectarget-'));
    await initRepo(cwd);
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('default (no flags) → last done phase, from its preSha to HEAD, phase-<id>.md', async () => {
    const c1 = await commit(cwd, 'a'); // preSha of phase 1
    const c2 = await commit(cwd, 'b'); // preSha of phase 2
    const head = await commit(cwd, 'c'); // HEAD after phase 2 → the review end
    await save(stateOf([donePhase(1, c1), donePhase(2, c2)]), cwd);

    const target = await resolveSecurityTarget(cwd, {});
    expect(target).not.toBeNull();
    // End is HEAD, not the next phase's preSha — there is no committed next phase.
    expect(target?.input).toEqual({ from: c2, to: head });
    expect(target?.outputPath).toBe(join('.mini', 'security', 'phase-2.md'));
  });

  it('default does not hard-fail when the next phase exists but is uncommitted (no preSha)', async () => {
    const c1 = await commit(cwd, 'a'); // preSha of phase 1
    const head = await commit(cwd, 'b'); // phase 1 commit = HEAD
    // Phase 2 exists (in progress) with NO preSha — the realistic state right
    // after finishing phase 1 and starting phase 2.
    await save(
      stateOf([donePhase(1, c1), { id: 2, title: 'P2', status: 'doing' }]),
      cwd,
    );

    const target = await resolveSecurityTarget(cwd, {});
    expect(target).not.toBeNull();
    expect(target?.input).toEqual({ from: c1, to: head });
    expect(target?.outputPath).toBe(join('.mini', 'security', 'phase-1.md'));
  });

  it('default falls through the genesis fallback for a first done phase without preSha', async () => {
    await commit(cwd, 'a'); // HEAD → range end; no preSha on the phase
    await save(stateOf([donePhase(1)]), cwd);

    const target = await resolveSecurityTarget(cwd, {});
    expect(target).not.toBeNull();
    expect(target?.input).toEqual({ fromPhase: 1, toPhase: 1 });
    expect(target?.outputPath).toBe(join('.mini', 'security', 'phase-1.md'));
  });

  it('phase flags → range-<A>-<B>.md named from the phase numbers', async () => {
    const c1 = await commit(cwd, 'a');
    const c2 = await commit(cwd, 'b');
    await commit(cwd, 'c');
    await save(stateOf([donePhase(1, c1), donePhase(2, c2)]), cwd);

    const target = await resolveSecurityTarget(cwd, { fromPhase: 1, toPhase: 2 });
    expect(target?.input).toEqual({ fromPhase: 1, toPhase: 2 });
    expect(target?.outputPath).toBe(join('.mini', 'security', 'range-1-2.md'));
  });

  it('ref flags → range-<short>-<short>.md named from the resolved SHAs', async () => {
    const c1 = await commit(cwd, 'a');
    const c2 = await commit(cwd, 'b');
    await save(stateOf([donePhase(1)]), cwd);

    const target = await resolveSecurityTarget(cwd, { from: 'HEAD~1', to: 'HEAD' });
    expect(target?.input).toEqual({ from: 'HEAD~1', to: 'HEAD' });
    expect(target?.outputPath).toBe(
      join('.mini', 'security', `range-${c1.slice(0, 7)}-${c2.slice(0, 7)}.md`),
    );
  });

  it('returns null when there is no completed phase yet', async () => {
    await commit(cwd, 'a');
    await save(stateOf([{ id: 1, title: 'P1', status: 'doing' }]), cwd);

    const target = await resolveSecurityTarget(cwd, {});
    expect(target).toBeNull();
  });

  it('returns null on an invalid git ref', async () => {
    await commit(cwd, 'a');
    await save(stateOf([donePhase(1)]), cwd);

    const target = await resolveSecurityTarget(cwd, { from: 'HEAD', to: 'no-such-ref' });
    expect(target).toBeNull();
  });

  it('returns null when phase and ref flags are mixed', async () => {
    await commit(cwd, 'a');
    await save(stateOf([donePhase(1)]), cwd);

    const target = await resolveSecurityTarget(cwd, { fromPhase: 1, to: 'HEAD' });
    expect(target).toBeNull();
  });
});
