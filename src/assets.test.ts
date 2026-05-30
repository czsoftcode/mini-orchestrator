import { describe, expect, it } from 'vitest';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { readSkeletonEntries, skeletonDir } from './assets.js';

describe('skeletonDir', () => {
  it('vrátí existující adresář s .gitignore', async () => {
    const dir = await skeletonDir();
    await expect(access(join(dir, '.gitignore'))).resolves.toBeUndefined();
  });
});

describe('readSkeletonEntries', () => {
  it('najde .gitignore a 4 adresáře, .gitkeep přeskočí', async () => {
    const entries = await readSkeletonEntries();

    const files = entries.filter((e) => e.kind === 'file').map((e) => e.relPath).sort();
    const dirs = entries.filter((e) => e.kind === 'dir').map((e) => e.relPath).sort();

    expect(files).toEqual(['.gitignore']);
    expect(dirs).toEqual(['discuss', 'memory', 'phases', 'run']);
    // .gitkeep je jen pro git v repu, do výpisu nepatří
    expect(entries.some((e) => e.relPath.endsWith('.gitkeep'))).toBe(false);
  });
});
