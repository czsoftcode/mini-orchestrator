import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bumpPackageVersion,
  bumpSemver,
  compareSemver,
  isBumpLevel,
  readPackageVersion,
} from './version.js';

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

describe('compareSemver', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1);
    expect(compareSemver('1.2.3', '1.2.4')).toBe(-1);
  });
  it('treats equal versions as 0', () => {
    expect(compareSemver('1.9.0', '1.9.0')).toBe(0);
  });
  it('compares numerically, not lexically (1.10.0 > 1.9.0)', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
  });
  it('ignores prerelease/build suffixes', () => {
    expect(compareSemver('1.2.3-beta.1', '1.2.3')).toBe(0);
  });
  it('returns null when either side is not x.y.z', () => {
    expect(compareSemver('not-a-version', '1.0.0')).toBeNull();
    expect(compareSemver('1.0.0', '')).toBeNull();
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

describe('readPackageVersion', () => {
  it('vrátí verzi z reálného package.json', async () => {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as { version: string };

    expect(readPackageVersion()).toBe(pkg.version);
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
