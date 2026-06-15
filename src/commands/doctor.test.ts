import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type DoctorInput,
  buildDiagnostics,
  doctor,
  findStaleDecisions,
  findStaleRunReports,
} from './doctor.js';
import { phasePath, save, writeProject } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';

const HEALTHY: DoctorInput = {
  projectExists: true,
  schemaVersion: 2,
  expectedSchema: 2,
  hasProjectMd: true,
  hasChangelog: true,
  corruptPhaseFile: null,
  orphanedDoingPhases: [],
  staleRunReports: [],
  staleDecisions: [],
  installedCommands: 17,
  expectedCommands: 17,
  currentVersion: '1.11.1',
  latestVersion: '1.11.1',
};

function find(input: DoctorInput, label: string) {
  return buildDiagnostics(input).find((c) => c.label === label)!;
}

describe('buildDiagnostics', () => {
  it('all green for a healthy project', () => {
    expect(buildDiagnostics(HEALTHY).every((c) => c.status === 'ok')).toBe(true);
  });

  it('fails with an init hint when there is no project', () => {
    const c = find({ ...HEALTHY, projectExists: false }, 'Project');
    expect(c.status).toBe('fail');
    expect(c.hint).toContain('mini init');
  });

  it('fails with a migrate hint on a legacy schema', () => {
    const c = find({ ...HEALTHY, schemaVersion: 1 }, 'Project');
    expect(c.status).toBe('fail');
    expect(c.hint).toContain('mini migrate');
  });

  it('warns when project.md / CHANGELOG.md are missing', () => {
    expect(find({ ...HEALTHY, hasProjectMd: false }, 'project.md').status).toBe('warn');
    expect(find({ ...HEALTHY, hasChangelog: false }, 'CHANGELOG.md').status).toBe('warn');
  });

  it('warns to install when no slash commands are present', () => {
    const c = find({ ...HEALTHY, installedCommands: 0 }, 'Slash commands');
    expect(c.status).toBe('warn');
    expect(c.hint).toContain('install-commands');
  });

  it('warns to reinstall the slash commands when they are outdated', () => {
    const c = find({ ...HEALTHY, installedCommands: 15 }, 'Slash commands');
    expect(c.status).toBe('warn');
    expect(c.hint).toContain('install-commands');
  });

  it('warns to upgrade when a newer version is available', () => {
    const c = find({ ...HEALTHY, latestVersion: '1.12.0' }, 'Version');
    expect(c.status).toBe('warn');
    expect(c.hint).toContain('mini upgrade');
  });

  it('stays ok with an unknown latest version', () => {
    const c = find({ ...HEALTHY, latestVersion: null }, 'Version');
    expect(c.status).toBe('ok');
    expect(c.detail).toContain('latest unknown');
  });

  it('warns about an orphaned "doing" phase and names it', () => {
    const c = find({ ...HEALTHY, orphanedDoingPhases: [7] }, 'Phases');
    expect(c.status).toBe('warn');
    expect(c.detail).toContain('7');
    expect(c.hint).toContain('mini done');
  });

  it('warns about stale run reports and counts them', () => {
    const c = find({ ...HEALTHY, staleRunReports: ['phase-009.md', 'phase-010.md'] }, 'Run reports');
    expect(c.status).toBe('warn');
    expect(c.detail).toContain('2 stale');
  });

  it('stays ok with no stale decision records', () => {
    expect(find(HEALTHY, 'Decisions').status).toBe('ok');
  });

  it('warns about stale decision records, counts and names them', () => {
    const c = find({ ...HEALTHY, staleDecisions: ['phase-009.md', 'phase-010.md'] }, 'Decisions');
    expect(c.status).toBe('warn');
    expect(c.detail).toContain('2 stale');
    expect(c.detail).toContain('phase-009.md');
    expect(c.hint).toContain('.mini/decisions/');
  });

  it('fails and names the file when a phase file is corrupt', () => {
    const c = find({ ...HEALTHY, corruptPhaseFile: '.mini/phases/phase-007.json' }, 'Phases');
    expect(c.status).toBe('fail');
    expect(c.detail).toContain('.mini/phases/phase-007.json');
    expect(c.hint).toBeTruthy();
  });

  it('suppresses the stale/orphaned checks when a phase file is corrupt', () => {
    // The hygiene checks need the full state that failed to load, so they must
    // not run — only the single "Phases" failure should be reported.
    const checks = buildDiagnostics({
      ...HEALTHY,
      corruptPhaseFile: '.mini/phases/phase-007.json',
      orphanedDoingPhases: [7],
      staleRunReports: ['phase-009.md'],
      staleDecisions: ['phase-009.md'],
    });
    const phaseChecks = checks.filter((c) => c.label === 'Phases');
    expect(phaseChecks).toHaveLength(1);
    expect(phaseChecks[0]!.status).toBe('fail');
    expect(checks.find((c) => c.label === 'Run reports')).toBeUndefined();
    expect(checks.find((c) => c.label === 'Decisions')).toBeUndefined();
  });

  it('omits the phase-hygiene checks when there is no project', () => {
    const checks = buildDiagnostics({ ...HEALTHY, projectExists: false });
    expect(checks.find((c) => c.label === 'Phases')).toBeUndefined();
    expect(checks.find((c) => c.label === 'Run reports')).toBeUndefined();
    expect(checks.find((c) => c.label === 'Decisions')).toBeUndefined();
  });
});

describe('doctor() — corrupt phase file', () => {
  let cwd: string;
  let prevCwd: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  function stateWithPhase(): ProjectState {
    return {
      version: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      currentPhaseId: 7,
      phases: [
        {
          id: 7,
          title: 'Phase',
          goal: 'do something',
          status: 'doing',
          steps: [{ title: 'step 1', status: 'todo' }],
        },
      ],
    };
  }

  beforeEach(async () => {
    prevCwd = process.cwd();
    cwd = await mkdtemp(join(tmpdir(), 'mini-doctor-'));
    process.chdir(cwd);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    logSpy.mockRestore();
    process.chdir(prevCwd);
    await rm(cwd, { recursive: true, force: true });
  });

  it('reports the corruption instead of crashing', async () => {
    await writeProject('# Project', cwd);
    await save(stateWithPhase(), cwd);
    // Simulate an unresolved git merge conflict in a phase file — a realistic
    // state the project explicitly resolves via git.
    await writeFile(
      phasePath(cwd, 7),
      '<<<<<<< HEAD\n{"id":7}\n=======\n{"id":7,"title":"x"}\n>>>>>>> branch\n',
      'utf-8',
    );

    await expect(doctor()).resolves.toBeUndefined();

    const out = logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(out).toContain('phase-007.json');
    expect(out).toContain('unreadable');
  });
});

describe('findStaleRunReports', () => {
  const phases: Phase[] = [
    { id: 1, title: 'A', status: 'done' },
    { id: 12, title: 'B', status: 'done' },
  ];

  it('flags report files whose phase is gone, leaving valid ones', () => {
    const files = ['phase-001.md', 'phase-009.md', 'phase-012.md', 'phase-013.md'];
    expect(findStaleRunReports(files, phases)).toEqual(['phase-009.md', 'phase-013.md']);
  });

  it('ignores .prev.md backups and non-report files', () => {
    const files = ['phase-009.prev.md', 'phase-001.md', 'README.md', '.gitkeep'];
    expect(findStaleRunReports(files, phases)).toEqual([]);
  });

  it('returns [] when every report has a phase', () => {
    expect(findStaleRunReports(['phase-001.md', 'phase-012.md'], phases)).toEqual([]);
  });
});

describe('findStaleDecisions', () => {
  const phases: Phase[] = [
    { id: 1, title: 'A', status: 'done' },
    { id: 12, title: 'B', status: 'done' },
    { id: 1.5, title: 'A.1', status: 'done' },
  ];

  it('keeps ADRs with a matching phase (incl. a dotted subphase), flags the rest', () => {
    const files = ['phase-001.md', 'phase-1.5.md', 'phase-009.md', 'phase-012.md', 'phase-013.md'];
    expect(findStaleDecisions(files, phases)).toEqual(['phase-009.md', 'phase-013.md']);
  });

  it('ignores files that are not phase-<id>.md', () => {
    const files = ['README.md', 'phase-009.prev.md', '.gitkeep', 'phase-.md'];
    expect(findStaleDecisions(files, phases)).toEqual([]);
  });

  it('returns [] when every decision has a phase', () => {
    expect(findStaleDecisions(['phase-001.md', 'phase-1.5.md', 'phase-012.md'], phases)).toEqual([]);
  });
});
