import { describe, expect, it } from 'vitest';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { readSkeletonEntries, skeletonDir } from './assets.js';

describe('skeletonDir', () => {
  it('vrátí existující adresář s gitignore (npm-safe, bez tečky)', async () => {
    const dir = await skeletonDir();
    // Na disku skeletonu je soubor `gitignore` (ne `.gitignore`) — kdyby měl
    // tečku, npm publish by ho z balíčku vyřadil.
    await expect(access(join(dir, 'gitignore'))).resolves.toBeUndefined();
  });
});

describe('readSkeletonEntries', () => {
  it('najde .gitignore a 4 adresáře, .gitkeep přeskočí', async () => {
    const entries = await readSkeletonEntries();

    const files = entries.filter((e) => e.kind === 'file').map((e) => e.relPath).sort();
    const dirs = entries.filter((e) => e.kind === 'dir').map((e) => e.relPath).sort();

    // relPath je cílové jméno v projektu — gitignore se mapuje na .gitignore
    expect(files).toEqual(['.gitignore']);
    expect(dirs).toEqual(['discuss', 'memory', 'phases', 'run']);
    // .gitkeep je jen pro git v repu, do výpisu nepatří
    expect(entries.some((e) => e.relPath.endsWith('.gitkeep'))).toBe(false);
  });

  it('gitignore má cíl .gitignore, ale zdroj na disku gitignore', async () => {
    const entries = await readSkeletonEntries();
    const gi = entries.find((e) => e.relPath === '.gitignore');
    expect(gi).toBeDefined();
    expect(gi?.srcRelPath).toBe('gitignore');
    // ostatní (adresáře) mají zdroj == cíl
    for (const e of entries.filter((x) => x.kind === 'dir')) {
      expect(e.srcRelPath).toBe(e.relPath);
    }
  });
});
