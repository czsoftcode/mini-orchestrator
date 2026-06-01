import { describe, expect, it } from 'vitest';
import { type DoctorInput, buildDiagnostics } from './doctor.js';

const HEALTHY: DoctorInput = {
  projectExists: true,
  schemaVersion: 2,
  expectedSchema: 2,
  hasProjectMd: true,
  hasChangelog: true,
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

  it('warns to update when slash commands are outdated', () => {
    const c = find({ ...HEALTHY, installedCommands: 15 }, 'Slash commands');
    expect(c.status).toBe('warn');
    expect(c.hint).toContain('mini update');
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
});
