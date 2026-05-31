import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bumpProjectVersion, FALLBACK_INITIAL_VERSION } from './projectVersion.js';

describe('bumpProjectVersion', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-pv-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  const read = (file: string) => readFile(join(cwd, file), 'utf-8');
  const write = (file: string, content: string) => writeFile(join(cwd, file), content, 'utf-8');

  describe('package.json', () => {
    it('bumps the version and reports the source', async () => {
      await write('package.json', '{\n  "name": "x",\n  "version": "1.2.3"\n}\n');

      const r = await bumpProjectVersion(cwd, 'minor');

      expect(r).toEqual({ from: '1.2.3', to: '1.3.0', source: 'package.json' });
      expect(await read('package.json')).toContain('"version": "1.3.0"');
    });
  });

  describe('Cargo.toml', () => {
    it('bumps version only in [package], not in [dependencies]', async () => {
      const before =
        '[package]\nname = "x"\nversion = "0.4.1"\n\n[dependencies]\nserde = "1.0.0"\n';
      await write('Cargo.toml', before);

      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r).toEqual({ from: '0.4.1', to: '0.4.2', source: 'Cargo.toml' });
      const after = await read('Cargo.toml');
      expect(after).toContain('version = "0.4.2"');
      expect(after).toContain('serde = "1.0.0"'); // dependency untouched
    });

    it('falls through to VERSION for a workspace root without [package]', async () => {
      await write('Cargo.toml', '[workspace]\nmembers = ["a", "b"]\n');

      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r?.source).toBe('VERSION');
    });
  });

  describe('pyproject.toml', () => {
    it('bumps version in [project]', async () => {
      await write('pyproject.toml', '[project]\nname = "x"\nversion = "2.0.0"\n');

      const r = await bumpProjectVersion(cwd, 'major');

      expect(r).toEqual({ from: '2.0.0', to: '3.0.0', source: 'pyproject.toml' });
    });

    it('bumps version in [tool.poetry] when [project] has none', async () => {
      await write(
        'pyproject.toml',
        '[build-system]\nrequires = ["poetry"]\n\n[tool.poetry]\nname = "x"\nversion = "0.9.0"\n',
      );

      const r = await bumpProjectVersion(cwd, 'minor');

      expect(r).toEqual({ from: '0.9.0', to: '0.10.0', source: 'pyproject.toml' });
    });

    it('falls through when version is dynamic (no literal version line)', async () => {
      await write('pyproject.toml', '[project]\nname = "x"\ndynamic = ["version"]\n');

      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r?.source).toBe('VERSION');
    });
  });

  describe('setup.py', () => {
    it('bumps version="x.y.z"', async () => {
      await write('setup.py', 'from setuptools import setup\nsetup(name="x", version="1.0.0")\n');

      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r).toEqual({ from: '1.0.0', to: '1.0.1', source: 'setup.py' });
      expect(await read('setup.py')).toContain('version="1.0.1"');
    });
  });

  describe('composer.json', () => {
    it('bumps version when the field is present', async () => {
      await write('composer.json', '{\n  "name": "x/y",\n  "version": "3.1.0"\n}\n');

      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r).toEqual({ from: '3.1.0', to: '3.1.1', source: 'composer.json' });
    });

    it('does not add a version field when absent — falls through to VERSION', async () => {
      await write('composer.json', '{\n  "name": "x/y"\n}\n');

      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r?.source).toBe('VERSION');
      expect(await read('composer.json')).not.toContain('"version"');
    });
  });

  describe('__version__', () => {
    it('bumps __version__ in a package __init__.py', async () => {
      await mkdir(join(cwd, 'mypkg'));
      await write('mypkg/__init__.py', '__version__ = "0.2.0"\n');

      const r = await bumpProjectVersion(cwd, 'minor');

      expect(r).toEqual({ from: '0.2.0', to: '0.3.0', source: '__version__' });
      expect(await read('mypkg/__init__.py')).toContain('__version__ = "0.3.0"');
    });
  });

  describe('VERSION fallback', () => {
    it('creates VERSION with the initial version when nothing else matches', async () => {
      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r).toEqual({
        from: '0.0.0',
        to: FALLBACK_INITIAL_VERSION,
        source: 'VERSION',
        created: true,
      });
      expect((await read('VERSION')).trim()).toBe(FALLBACK_INITIAL_VERSION);
    });

    it('bumps an existing VERSION file', async () => {
      await write('VERSION', '1.4.0\n');

      const r = await bumpProjectVersion(cwd, 'minor');

      expect(r).toEqual({ from: '1.4.0', to: '1.5.0', source: 'VERSION' });
      expect(await read('VERSION')).toBe('1.5.0\n');
    });
  });

  describe('priority between manifests', () => {
    it('picks package.json over Cargo.toml when both exist', async () => {
      await write('package.json', '{\n  "version": "1.0.0"\n}\n');
      await write('Cargo.toml', '[package]\nname = "x"\nversion = "9.9.9"\n');

      const r = await bumpProjectVersion(cwd, 'patch');

      expect(r?.source).toBe('package.json');
      // Cargo.toml stays untouched
      expect(await read('Cargo.toml')).toContain('version = "9.9.9"');
    });
  });
});
