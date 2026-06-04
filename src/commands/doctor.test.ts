import { describe, expect, it } from 'vitest';
import {
  type DoctorInput,
  buildDiagnostics,
  findStaleDecisions,
  findStaleRunReports,
} from './doctor.js';
import type { Phase } from '../state/types.js';

const HEALTHY: DoctorInput = {
  projectExists: true,
  schemaVersion: 2,
  expectedSchema: 2,
  hasProjectMd: true,
  hasChangelog: true,
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

  it('omits the phase-hygiene checks when there is no project', () => {
    const checks = buildDiagnostics({ ...HEALTHY, projectExists: false });
    expect(checks.find((c) => c.label === 'Phases')).toBeUndefined();
    expect(checks.find((c) => c.label === 'Run reports')).toBeUndefined();
    expect(checks.find((c) => c.label === 'Decisions')).toBeUndefined();
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
