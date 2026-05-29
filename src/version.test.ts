import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bumpPackageVersion, bumpSemver, isBumpLevel } from './version.js';

describe('bumpSemver', () => {
  it('navýší patch', () => {
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4');
  });
  it('navýší minor a vynuluje patch', () => {
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0');
  });
  it('navýší major a vynuluje minor i patch', () => {
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0');
  });
  it('zahodí prerelease/build suffix', () => {
    expect(bumpSemver('1.2.3-beta.1', 'patch')).toBe('1.2.4');
  });
  it('vrátí null pro nevalidní verzi', () => {
    expect(bumpSemver('není-verze', 'patch')).toBeNull();
  });
});

describe('isBumpLevel', () => {
  it('rozpozná platné úrovně', () => {
    expect(isBumpLevel('patch')).toBe(true);
    expect(isBumpLevel('minor')).toBe(true);
    expect(isBumpLevel('major')).toBe(true);
  });
  it('odmítne neplatné', () => {
    expect(isBumpLevel('pách')).toBe(false);
    expect(isBumpLevel('')).toBe(false);
  });
});

describe('bumpPackageVersion', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-version-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('navýší verzi v package.json (default patch) a vrátí from/to', async () => {
    await writeFile(join(cwd, 'package.json'), '{\n  "name": "x",\n  "version": "0.1.0"\n}\n', 'utf-8');

    const r = await bumpPackageVersion(cwd);

    expect(r).toEqual({ from: '0.1.0', to: '0.1.1' });
    const after = await readFile(join(cwd, 'package.json'), 'utf-8');
    expect(after).toContain('"version": "0.1.1"');
  });

  it('respektuje úroveň minor', async () => {
    await writeFile(join(cwd, 'package.json'), '{\n  "version": "1.4.9"\n}\n', 'utf-8');

    const r = await bumpPackageVersion(cwd, 'minor');

    expect(r).toEqual({ from: '1.4.9', to: '1.5.0' });
  });

  it('zachová formátování — změní jen řádek s verzí', async () => {
    const before = '{\n  "name": "x",\n  "version": "0.1.0",\n  "scripts": {\n    "build": "tsc"\n  }\n}\n';
    await writeFile(join(cwd, 'package.json'), before, 'utf-8');

    await bumpPackageVersion(cwd, 'patch');

    const after = await readFile(join(cwd, 'package.json'), 'utf-8');
    expect(after).toBe(before.replace('"version": "0.1.0"', '"version": "0.1.1"'));
  });

  it('tiše vrátí null, když package.json chybí', async () => {
    const r = await bumpPackageVersion(cwd);
    expect(r).toBeNull();
  });

  it('vrátí null, když package.json nemá pole version', async () => {
    await writeFile(join(cwd, 'package.json'), '{\n  "name": "x"\n}\n', 'utf-8');
    const r = await bumpPackageVersion(cwd);
    expect(r).toBeNull();
  });
});
