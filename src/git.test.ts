import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  commitAll,
  currentBranch,
  hasChanges,
  headSha,
  headSubject,
  isCleanWorkingTree,
  isGitRepo,
  push,
  runGit,
  softResetTo,
} from './git.js';

const execFileAsync = promisify(execFile);

async function initRepo(cwd: string): Promise<void> {
  // `init.defaultBranch=main` + lokální user.email/name, ať testy nezávisí
  // na globální git konfiguraci uživatele, který je spustí.
  await execFileAsync('git', ['init', '-b', 'main'], { cwd });
  await execFileAsync('git', ['config', 'user.email', 'mini-test@example.com'], { cwd });
  await execFileAsync('git', ['config', 'user.name', 'Mini Test'], { cwd });
  // Commit signing může být v globální konfiguraci zapnutý — vypneme lokálně,
  // aby `git commit` v testech nepadal na chybějícím klíči.
  await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
}

describe('git helpers', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'mini-git-'));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  describe('isGitRepo', () => {
    it('vrátí false pro adresář bez gitu', async () => {
      expect(await isGitRepo(cwd)).toBe(false);
    });

    it('vrátí true po `git init`', async () => {
      await initRepo(cwd);
      expect(await isGitRepo(cwd)).toBe(true);
    });
  });

  describe('hasChanges', () => {
    it('vrátí false v čerstvém repu bez souborů', async () => {
      await initRepo(cwd);
      expect(await hasChanges(cwd)).toBe(false);
    });

    it('vrátí true, když existuje untracked soubor', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'novy.txt'), 'ahoj\n', 'utf-8');
      expect(await hasChanges(cwd)).toBe(true);
    });

    it('vrátí false poté, co se vše commitne', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'init');
      expect(await hasChanges(cwd)).toBe(false);
    });
  });

  describe('commitAll', () => {
    it('vytvoří commit a srovná working tree', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'soubor.txt'), 'obsah\n', 'utf-8');

      const r = await commitAll(cwd, 'Fáze 1: testovací commit');

      expect(r.ok).toBe(true);
      expect(await hasChanges(cwd)).toBe(false);

      const log = await runGit(['log', '--oneline'], cwd);
      expect(log.ok).toBe(true);
      expect(log.stdout).toContain('Fáze 1: testovací commit');
    });

    it('vrátí ok=false, když není co commitnout v čerstvém repu', async () => {
      await initRepo(cwd);
      const r = await commitAll(cwd, 'prázdný commit');
      expect(r.ok).toBe(false);
    });
  });

  describe('currentBranch', () => {
    it('vrátí název větve po prvním commitu', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'init');

      expect(await currentBranch(cwd)).toBe('main');
    });
  });

  describe('runGit', () => {
    it('nehází ani když git binárka odmítne (neplatný adresář)', async () => {
      const r = await runGit(['rev-parse', '--is-inside-work-tree'], cwd);
      expect(r.ok).toBe(false);
      // stderr by mělo obsahovat fatal o nedostupném gitu, ale nezávisle na
      // lokalizaci si jen ověříme, že to není výjimka.
    });
  });

  describe('headSha', () => {
    it('vrátí null v repu bez commitu', async () => {
      await initRepo(cwd);
      expect(await headSha(cwd)).toBeNull();
    });

    it('vrátí 40-znakový SHA po commitu', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'init');

      const sha = await headSha(cwd);
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it('vrátí null mimo git repo', async () => {
      expect(await headSha(cwd)).toBeNull();
    });
  });

  describe('headSubject', () => {
    it('vrátí subject posledního commitu', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'Fáze 1: Něco hotového\n\ntělo poznámky\n');

      expect(await headSubject(cwd)).toBe('Fáze 1: Něco hotového');
    });

    it('vrátí null v repu bez commitu', async () => {
      await initRepo(cwd);
      expect(await headSubject(cwd)).toBeNull();
    });
  });

  describe('isCleanWorkingTree', () => {
    it('true v čerstvém repu bez souborů', async () => {
      await initRepo(cwd);
      expect(await isCleanWorkingTree(cwd)).toBe(true);
    });

    it('false, když je untracked soubor', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'novy.txt'), 'x\n', 'utf-8');
      expect(await isCleanWorkingTree(cwd)).toBe(false);
    });

    it('true po commitu všech změn', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'init');
      expect(await isCleanWorkingTree(cwd)).toBe(true);
    });

    it('false mimo git repo', async () => {
      expect(await isCleanWorkingTree(cwd)).toBe(false);
    });
  });

  describe('push', () => {
    it('nehází a vrátí ok=false, když není upstream', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'init');

      const r = await push(cwd);
      expect(r.ok).toBe(false);
    });

    it('vrátí ok=true při pushi na nastavený upstream', async () => {
      const remote = await mkdtemp(join(tmpdir(), 'mini-remote-'));
      try {
        await execFileAsync('git', ['init', '--bare', '-b', 'main'], { cwd: remote });
        await initRepo(cwd);
        await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
        await commitAll(cwd, 'init');
        await execFileAsync('git', ['remote', 'add', 'origin', remote], { cwd });
        await execFileAsync('git', ['push', '-u', 'origin', 'main'], { cwd });

        // další commit, ať má push co nahrát
        await writeFile(join(cwd, 'b.txt'), 'b\n', 'utf-8');
        await commitAll(cwd, 'second');

        const r = await push(cwd);
        expect(r.ok).toBe(true);
      } finally {
        await rm(remote, { recursive: true, force: true });
      }
    });
  });

  describe('softResetTo', () => {
    it('vrátí HEAD na zadaný SHA a změny zůstanou v indexu', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'first');
      const firstSha = await headSha(cwd);
      expect(firstSha).not.toBeNull();

      await writeFile(join(cwd, 'b.txt'), 'b\n', 'utf-8');
      await commitAll(cwd, 'second');
      const secondSha = await headSha(cwd);
      expect(secondSha).not.toBe(firstSha);

      const r = await softResetTo(cwd, firstSha!);
      expect(r.ok).toBe(true);
      expect(await headSha(cwd)).toBe(firstSha);

      // změny z druhého commitu zůstávají nastagované — git status --porcelain
      // ukáže `A  b.txt` (index má soubor přidaný oproti HEAD).
      const status = await runGit(['status', '--porcelain'], cwd);
      expect(status.stdout).toContain('A  b.txt');
    });

    it('vrátí ok=false pro neexistující SHA', async () => {
      await initRepo(cwd);
      await writeFile(join(cwd, 'a.txt'), 'a\n', 'utf-8');
      await commitAll(cwd, 'init');

      const r = await softResetTo(cwd, '0000000000000000000000000000000000000000');
      expect(r.ok).toBe(false);
    });
  });
});
