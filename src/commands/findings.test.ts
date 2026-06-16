import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { headSha } from '../git.js';
import { save, writeProject } from '../state/store.js';
import { type Finding, FINDING_SOURCES, readPhaseFindings } from '../state/findingsStore.js';
import type { ProjectState } from '../state/types.js';
import { findingsAdd, findingsList, findingsReopen, findingsResolve } from './findings.js';

const execFileAsync = promisify(execFile);

/** A git repo with one commit, so `headSha` returns a stable, known value. */
async function initRepoWithCommit(cwd: string): Promise<string> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'mini-test@example.com'], { cwd });
  await execFileAsync('git', ['config', 'user.name', 'Mini Test'], { cwd });
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
  await writeFile(join(cwd, 'seed.txt'), 'seed', 'utf8');
  await execFileAsync('git', ['add', '-A'], { cwd });
  await execFileAsync('git', ['commit', '-m', 'seed'], { cwd });
  const sha = await headSha(cwd);
  if (!sha) throw new Error('expected a HEAD sha after the seed commit');
  return sha;
}

function stateWithCurrentPhase(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: 5,
    phases: [{ id: 5, title: 'Current', status: 'doing' }],
  };
}

function stateWithLastDone(): ProjectState {
  return {
    version: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentPhaseId: null,
    phases: [
      { id: 1, title: 'Older', status: 'done' },
      { id: 2, title: 'Last closed', status: 'done' },
    ],
  };
}

describe('mini findings', () => {
  let cwd: string;
  let prevCwd: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-findings-cmd-'));
    process.chdir(cwd);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  function output(): string {
    // Both streams: log.info/success/warn write to console.log, log.error to
    // console.error — a finding-not-found line lands on the latter.
    return [...logSpy.mock.calls, ...errSpy.mock.calls]
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
  }

  // The CLI's --source choices derive from FINDING_SOURCES (cli.ts) so the two
  // cannot drift apart again. Removing 'project' here would silently re-break the
  // adversarial-project workflow, so guard the data model directly.
  it("FINDING_SOURCES includes 'project' (CLI --source choices derive from it)", () => {
    expect(FINDING_SOURCES).toContain('project');
  });

  describe('add', () => {
    it('warns and does nothing when there is no project', async () => {
      const r = await findingsAdd({ severity: 'nit', title: 'x' });
      expect(r.ok).toBe(false);
      expect((r as { reason: string }).reason).toBe('no-project');
    });

    it('rejects a missing or invalid severity', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      expect((await findingsAdd({ title: 'x' })).ok).toBe(false);
      const bad = await findingsAdd({ severity: 'critical', title: 'x' });
      expect(bad).toEqual({ ok: false, reason: 'bad-severity' });
    });

    it('rejects a missing title', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);
      expect(await findingsAdd({ severity: 'nit' })).toEqual({ ok: false, reason: 'no-title' });
    });

    it('records a finding against the current phase and confirms with id + path', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      const r = await findingsAdd({
        severity: 'should-know',
        title: 'Null cascades',
        where: 'src/a.ts:9',
        body: 'detail',
      });

      expect(r.ok).toBe(true);
      expect(await readPhaseFindings(cwd, 5)).toEqual([
        {
          id: '5-1',
          phaseId: 5,
          severity: 'should-know',
          status: 'open',
          source: 'adversarial',
          where: 'src/a.ts:9',
          title: 'Null cascades',
          body: 'detail',
        },
      ]);
      // The confirmation must surface the assigned id, so a silent failure is visible.
      expect(output()).toContain('5-1');
      expect(output()).toContain('phase-005.md');
    });

    it('defaults source to adversarial when --source is omitted', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      await findingsAdd({ severity: 'nit', title: 'no source' });
      expect((await readPhaseFindings(cwd, 5))[0]?.source).toBe('adversarial');
    });

    it('records an explicit verify source', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      const r = await findingsAdd({ severity: 'should-know', title: 'ux issue', source: 'verify' });
      expect(r.ok).toBe(true);
      expect((await readPhaseFindings(cwd, 5))[0]?.source).toBe('verify');
    });

    it('records an explicit project source', async () => {
      // Regression guard for the adversarial-project blocker: the prompt instructs
      // `mini findings add --source project`, so this origin must round-trip.
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      const r = await findingsAdd({ severity: 'should-know', title: 'range issue', source: 'project' });
      expect(r.ok).toBe(true);
      expect((await readPhaseFindings(cwd, 5))[0]?.source).toBe('project');
    });

    it('records a reviewed range passed via --range', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      const r = await findingsAdd({
        severity: 'should-know',
        title: 'cross-range regression',
        source: 'project',
        range: '1-5',
      });
      expect(r.ok).toBe(true);
      expect((await readPhaseFindings(cwd, 5))[0]?.range).toBe('1-5');
    });

    it('omits range when --range is not passed (single-phase review)', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      await findingsAdd({ severity: 'nit', title: 'no range' });
      expect((await readPhaseFindings(cwd, 5))[0]).not.toHaveProperty('range');
    });

    it('rejects an invalid source', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      expect(await findingsAdd({ severity: 'nit', title: 'x', source: 'audit' })).toEqual({
        ok: false,
        reason: 'bad-source',
      });
    });

    it('omits reviewedAt outside a git repo (existing behaviour preserved)', async () => {
      // The temp dir is not a git repo, so `isGitRepo` is false and no SHA is stamped.
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      await findingsAdd({ severity: 'nit', title: 'no git here' });
      const stored = await readPhaseFindings(cwd, 5);
      expect(stored[0]).not.toHaveProperty('reviewedAt');
    });

    it('stamps reviewedAt with the HEAD SHA inside a git repo', async () => {
      const sha = await initRepoWithCommit(cwd);
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      await findingsAdd({ severity: 'should-know', title: 'reviewed against HEAD' });
      const stored = await readPhaseFindings(cwd, 5);
      expect(stored[0]?.reviewedAt).toBe(sha);
    });

    it('attaches the finding to the last closed phase when none is current', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithLastDone(), cwd);

      const r = await findingsAdd({ severity: 'nit', title: 'retro' });
      expect(r.ok).toBe(true);
      expect((await readPhaseFindings(cwd, 2)).map((f) => f.id)).toEqual(['2-1']);
      expect(await readPhaseFindings(cwd, 1)).toEqual([]);
    });

    it('errors when there is no phase to attach to', async () => {
      await writeProject('# Project', cwd);
      await save(
        { version: 2, createdAt: '2026-01-01T00:00:00.000Z', currentPhaseId: null, phases: [] },
        cwd,
      );
      expect(await findingsAdd({ severity: 'nit', title: 'x' })).toEqual({
        ok: false,
        reason: 'no-phase',
      });
    });
  });

  describe('list', () => {
    it('prints a friendly note for an empty store, never errors', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      const r = await findingsList({});
      expect(r.ok).toBe(true);
      expect(output()).toContain('No open findings.');
    });

    it('lists open findings across phases by default', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithLastDone(), cwd);
      await findingsAdd({ severity: 'blocker', title: 'first' });
      await findingsAdd({ severity: 'nit', title: 'second' });
      logSpy.mockClear();

      const r = await findingsList({});
      expect(r.ok).toBe(true);
      const out = output();
      expect(out).toContain('2-1');
      expect(out).toContain('[blocker]');
      expect(out).toContain('first');
      expect(out).toContain('second');
      // No git repo here, so nothing was stamped — no `@sha` marker on the line.
      expect(out).not.toContain('@');
    });

    it('shows the reviewed range in braces when a finding carries one', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);
      await findingsAdd({ severity: 'nit', title: 'range one', source: 'project', range: '1-5' });
      logSpy.mockClear();

      const r = await findingsList({});
      expect(r.ok).toBe(true);
      expect(output()).toContain('{1-5}');
    });

    it('shows the short reviewed-at SHA when a finding carries one', async () => {
      const sha = await initRepoWithCommit(cwd);
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);
      await findingsAdd({ severity: 'nit', title: 'reviewed' });
      logSpy.mockClear();

      const r = await findingsList({});
      expect(r.ok).toBe(true);
      const out = output();
      expect(out).toContain(`@${sha.slice(0, 7)}`);
      // The full 40-char hash must not clutter the line.
      expect(out).not.toContain(sha);
    });
  });

  describe('resolve / reopen', () => {
    /** Records one open finding against the current phase and returns its id. */
    async function seedFinding(title = 'seed'): Promise<string> {
      await findingsAdd({ severity: 'nit', title });
      const stored = await readPhaseFindings(cwd, 5);
      const id = stored[stored.length - 1]?.id;
      if (!id) throw new Error('expected a finding id after seeding');
      return id;
    }

    function statusOf(stored: Finding[], id: string): string | undefined {
      return stored.find((f) => f.id === id)?.status;
    }

    it('warns and does nothing when there is no project', async () => {
      const r = await findingsResolve(['5-1']);
      expect(r).toEqual({ ok: false, reason: 'no-project' });
    });

    it('errors when no id is given', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      expect(await findingsResolve([])).toEqual({ ok: false, reason: 'no-id' });
      // Whitespace-only ids are stripped, so they count as "none given" too.
      expect(await findingsReopen(['  '])).toEqual({ ok: false, reason: 'no-id' });
    });

    it('flips an open finding to resolved and confirms', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);
      const id = await seedFinding();
      logSpy.mockClear();

      const r = await findingsResolve([id]);
      expect(r).toEqual({ ok: true });
      expect(statusOf(await readPhaseFindings(cwd, 5), id)).toBe('resolved');
      expect(output()).toContain(`Finding ${id} resolved.`);
    });

    it('flips a resolved finding back to open and confirms', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);
      const id = await seedFinding();
      await findingsResolve([id]);
      logSpy.mockClear();

      const r = await findingsReopen([id]);
      expect(r).toEqual({ ok: true });
      expect(statusOf(await readPhaseFindings(cwd, 5), id)).toBe('open');
      expect(output()).toContain(`Finding ${id} reopened.`);
    });

    it('is an idempotent no-op (still ok) when already in the target state', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);
      const id = await seedFinding();
      await findingsResolve([id]);
      logSpy.mockClear();

      // Resolving an already-resolved finding: benign info, not an error.
      expect(await findingsResolve([id])).toEqual({ ok: true });
      expect(output()).toContain(`Finding ${id} is already resolved.`);

      // Reopening an already-open finding (the freshly seeded one is open) is the
      // same benign no-op on the reopen side.
      const open = await seedFinding('still open');
      logSpy.mockClear();
      expect(await findingsReopen([open])).toEqual({ ok: true });
      expect(output()).toContain(`Finding ${open} is already open.`);
    });

    it('reports an unknown id and exits non-zero', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      const r = await findingsResolve(['5-9']);
      expect(r).toEqual({ ok: false, reason: 'not-found' });
      expect(output()).toContain('No such finding: 5-9');
    });

    it('reports a malformed id (no -n suffix) without crashing', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);

      const r = await findingsResolve(['155']);
      expect(r).toEqual({ ok: false, reason: 'not-found' });
      expect(output()).toContain('No such finding: 155');
    });

    it('processes every id in a mixed batch and fails the exit code', async () => {
      await writeProject('# Project', cwd);
      await save(stateWithCurrentPhase(), cwd);
      const a = await seedFinding('first'); // 5-1
      const b = await seedFinding('second'); // 5-2
      logSpy.mockClear();

      // One valid, one unknown — the valid one must still flip, the call fails.
      const r = await findingsResolve([a, '5-99', b]);
      expect(r).toEqual({ ok: false, reason: 'not-found' });

      const stored = await readPhaseFindings(cwd, 5);
      expect(statusOf(stored, a)).toBe('resolved');
      expect(statusOf(stored, b)).toBe('resolved');

      const out = output();
      expect(out).toContain(`Finding ${a} resolved.`);
      expect(out).toContain('No such finding: 5-99');
      expect(out).toContain(`Finding ${b} resolved.`);
    });
  });
});
