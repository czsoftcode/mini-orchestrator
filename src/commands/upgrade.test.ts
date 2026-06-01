import { describe, expect, it } from 'vitest';
import { classifyInstall, decideUpgrade } from './upgrade.js';

describe('decideUpgrade', () => {
  it('is "available" when latest is newer', () => {
    expect(decideUpgrade('1.9.0', '1.9.1')).toBe('available');
    expect(decideUpgrade('1.9.0', '1.10.0')).toBe('available');
  });
  it('is "up-to-date" when latest is the same or older', () => {
    expect(decideUpgrade('1.9.0', '1.9.0')).toBe('up-to-date');
    expect(decideUpgrade('1.9.0', '1.8.0')).toBe('up-to-date');
  });
  it('is "unknown" when the lookup failed (latest null)', () => {
    expect(decideUpgrade('1.9.0', null)).toBe('unknown');
  });
});

describe('classifyInstall', () => {
  it('treats a global npm path as npm (upgradable)', () => {
    expect(classifyInstall('/usr/lib/node_modules/mini-orchestrator/dist/cli.js')).toBe('npm');
    expect(classifyInstall('/home/me/.local/lib/node_modules/mini-orchestrator/dist/cli.js')).toBe(
      'npm',
    );
  });
  it('treats the install-local layout as dev', () => {
    expect(classifyInstall('/home/me/.local/share/mini/versions/1.9.0/dist/cli.js')).toBe('dev');
  });
  it('treats running from source as dev', () => {
    expect(classifyInstall('/home/me/projects/mini/src/cli.ts')).toBe('dev');
    expect(classifyInstall('/home/me/projects/mini/src/cli.js')).toBe('dev');
  });
  it('defaults an unknown layout to npm', () => {
    expect(classifyInstall('/opt/weird/place/cli.js')).toBe('npm');
  });
});
