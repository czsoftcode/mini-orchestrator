import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildProjectAdversarialContext,
  resolveRangePhases,
} from './adversarialProjectContext.js';
import { savePhase, writeProject } from '../state/store.js';
import type { Phase } from '../state/types.js';

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

describe('resolveRangePhases', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-advproj-'));
  });
  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('phase mode: returns the in-range phases as id+title', async () => {
    await savePhaseWith(cwd, 1, 'One');
    await savePhaseWith(cwd, 2, 'Two');
    await savePhaseWith(cwd, 3, 'Three');
    const phases = await resolveRangePhases(cwd, { fromPhase: 1, toPhase: 2 });
    expect(phases).toEqual([
      { id: 1, title: 'One' },
      { id: 2, title: 'Two' },
    ]);
  });

  it('phase mode: skips a missing phase file rather than failing', async () => {
    await savePhaseWith(cwd, 1, 'One');
    // phase 2 is absent
    await savePhaseWith(cwd, 3, 'Three');
    const phases = await resolveRangePhases(cwd, { fromPhase: 1, toPhase: 3 });
    expect(phases).toEqual([
      { id: 1, title: 'One' },
      { id: 3, title: 'Three' },
    ]);
  });

  it('ref mode: returns an empty list (refs do not map to phases)', async () => {
    await savePhaseWith(cwd, 1, 'One');
    const phases = await resolveRangePhases(cwd, { from: 'HEAD~1', to: 'HEAD' });
    expect(phases).toEqual([]);
  });
});

describe('buildProjectAdversarialContext', () => {
  let cwd: string;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-advproj-'));
    await initRepo(cwd);
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cwd, { recursive: true, force: true });
  });

  it('returns null and logs the reason when no range is given', async () => {
    const out = await buildProjectAdversarialContext(cwd, {});
    expect(out).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it('returns null and logs the reason on an invalid git ref', async () => {
    await commit(cwd, 'a.txt');
    const out = await buildProjectAdversarialContext(cwd, {
      from: 'no-such-ref',
      to: 'HEAD',
    });
    expect(out).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it('builds the prompt for a phase range, with bounds, phase list and project block', async () => {
    const pre1 = await commit(cwd, 'a.txt'); // state before phase 1
    await commit(cwd, 'b.txt'); // phase 1's work
    await writeProject('# Demo\n\n## What I am building\nA thing.', cwd);
    await savePhaseWith(cwd, 1, 'First phase', pre1);

    const out = await buildProjectAdversarialContext(cwd, { fromPhase: 1, toPhase: 1 });
    expect(out).not.toBeNull();
    expect(out).toContain('git diff');
    expect(out).toContain('1. First phase');
    expect(out).toContain('mini findings add --source project');
    expect(out).toContain('What I am building');
  });

  it('degrades to a note when project.md is missing (still builds)', async () => {
    const pre1 = await commit(cwd, 'a.txt');
    await commit(cwd, 'b.txt');
    await savePhaseWith(cwd, 1, 'First phase', pre1);
    // no writeProject

    const out = await buildProjectAdversarialContext(cwd, { fromPhase: 1, toPhase: 1 });
    expect(out).not.toBeNull();
    expect(out).toContain('no .mini/project.md found');
  });
});
