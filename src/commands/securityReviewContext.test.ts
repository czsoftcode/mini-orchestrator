import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSecurityContext, buildSecurityReviewContext } from './securityReviewContext.js';
import { save, savePhase, writeProject } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';

const execFileAsync = promisify(execFile);

const OUT = '.mini/security/range-1-1.md';

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

async function savePhaseWith(
  cwd: string,
  id: number,
  title: string,
  preSha?: string,
): Promise<void> {
  const phase: Phase = { id, title, status: 'done' };
  if (preSha) phase.autoCommit = { preSha, subject: `Phase ${id}` };
  await savePhase(phase, cwd);
}

describe('buildSecurityReviewContext', () => {
  let cwd: string;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-sec-'));
    await initRepo(cwd);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns null and logs the reason when no range is given', async () => {
    const out = await buildSecurityReviewContext(cwd, {}, OUT);
    expect(out).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it('returns null and logs the reason on an inverted phase range', async () => {
    const pre1 = await commit(cwd, 'a.txt');
    await commit(cwd, 'b.txt');
    await savePhaseWith(cwd, 1, 'First phase', pre1);
    await savePhaseWith(cwd, 2, 'Second phase', pre1);

    const out = await buildSecurityReviewContext(cwd, { fromPhase: 2, toPhase: 1 }, OUT);
    expect(out).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it('returns null when a non-genesis from-phase has no recorded preSha', async () => {
    const pre1 = await commit(cwd, 'a.txt');
    await commit(cwd, 'b.txt');
    await savePhaseWith(cwd, 1, 'First phase', pre1);
    await savePhaseWith(cwd, 2, 'Second phase'); // no preSha, and not the first phase

    const out = await buildSecurityReviewContext(cwd, { fromPhase: 2, toPhase: 2 }, OUT);
    expect(out).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it('returns null and logs the reason on an invalid git ref', async () => {
    await commit(cwd, 'a.txt');
    const out = await buildSecurityReviewContext(cwd, { from: 'no-such-ref', to: 'HEAD' }, OUT);
    expect(out).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it('builds the prompt for a phase range, with bounds, phase list, threat model and output path', async () => {
    const pre1 = await commit(cwd, 'a.txt'); // state before phase 1
    await commit(cwd, 'b.txt'); // phase 1's work
    await writeProject('# Demo\n\n## What I am building\nA thing.', cwd);
    await savePhaseWith(cwd, 1, 'First phase', pre1);

    const out = await buildSecurityReviewContext(cwd, { fromPhase: 1, toPhase: 1 }, OUT);
    expect(out).not.toBeNull();
    expect(out).toContain('git diff');
    expect(out).toContain('1. First phase');
    expect(out).toContain('Threat model');
    expect(out).toContain(OUT);
    expect(out).toContain('What I am building');
    // Security writes its own report, not the findings store.
    expect(out).not.toContain('mini findings add');
  });

  it('ref mode: builds with an empty phase list (diff fallback)', async () => {
    await commit(cwd, 'a.txt');
    await commit(cwd, 'b.txt');
    await writeProject('# Demo\n\n## What I am building\nA thing.', cwd);

    const out = await buildSecurityReviewContext(cwd, { from: 'HEAD~1', to: 'HEAD' }, OUT);
    expect(out).not.toBeNull();
    expect(out).toContain('plain git refs');
    expect(out).toContain('work from the diff');
  });

  it('degrades to a note when project.md is missing (still builds, never throws)', async () => {
    const pre1 = await commit(cwd, 'a.txt');
    await commit(cwd, 'b.txt');
    await savePhaseWith(cwd, 1, 'First phase', pre1);
    // no writeProject

    const out = await buildSecurityReviewContext(cwd, { fromPhase: 1, toPhase: 1 }, OUT);
    expect(out).not.toBeNull();
    expect(out).toContain('no .mini/project.md found');
  });
});

function stateOf(phases: Phase[]): ProjectState {
  return { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId: null, phases };
}

describe('buildSecurityContext (resolve + build)', () => {
  let cwd: string;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-secctx-'));
    await initRepo(cwd);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  });

  it('default (no flags) resolves the last done phase and returns its prompt + phase-<id>.md path', async () => {
    const pre1 = await commit(cwd, 'a.txt');
    await commit(cwd, 'b.txt'); // HEAD = phase 1's commit
    await writeProject('# Demo\n\n## What I am building\nA thing.', cwd);
    await save(stateOf([{ id: 1, title: 'First phase', status: 'done', autoCommit: { preSha: pre1, subject: 'Phase 1' } }]), cwd);

    const ctx = await buildSecurityContext(cwd, {});
    expect(ctx).not.toBeNull();
    expect(ctx?.outputPath).toBe(join('.mini', 'security', 'phase-1.md'));
    expect(ctx?.prompt).toContain('git diff');
    expect(ctx?.prompt).toContain(join('.mini', 'security', 'phase-1.md'));
  });

  it('returns null (reason logged) when there is no completed phase to review', async () => {
    await commit(cwd, 'a.txt');
    await writeProject('# Demo', cwd);
    await save(stateOf([{ id: 1, title: 'P1', status: 'doing' }]), cwd);

    const ctx = await buildSecurityContext(cwd, {});
    expect(ctx).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });
});
