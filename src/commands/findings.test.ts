import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { save, writeProject } from '../state/store.js';
import { readPhaseFindings } from '../state/findingsStore.js';
import type { ProjectState } from '../state/types.js';
import { findingsAdd, findingsList } from './findings.js';

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

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-findings-cmd-'));
    process.chdir(cwd);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  function output(): string {
    return logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
  }

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
          where: 'src/a.ts:9',
          title: 'Null cascades',
          body: 'detail',
        },
      ]);
      // The confirmation must surface the assigned id, so a silent failure is visible.
      expect(output()).toContain('5-1');
      expect(output()).toContain('phase-005.md');
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
    });
  });
});
