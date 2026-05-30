import { access, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Statický skeleton `.mini/` (adresářová struktura + `.gitignore`) je jediný
 * zdroj pravdy pro `mini init` (zakládání) i `mini update` (srovnání projektu).
 * Tenhle modul ho najde na disku a vyjmenuje jeho položky.
 *
 * Skeleton žije na dvou místech podle toho, odkud mini běží:
 * - z buildu/instalace (`dist/assets.js`) → `dist/skeleton/.mini` (kopíruje tam
 *   ho `scripts/copy-assets.mjs`; jen `dist` se balí a instaluje),
 * - ze zdrojáku (dev/testy přes tsx/vitest, `src/assets.ts`) → repo
 *   `assets/skeleton/.mini`.
 *
 * Cesty se odvozují od umístění tohoto modulu (`import.meta.url`) jako u
 * `version.ts`. Kandidáty zkoušíme v pořadí a vrátíme první, který existuje —
 * funguje to v obou režimech bez ohledu na to, jestli proběhl build.
 */
const SKELETON_CANDIDATES = [
  './skeleton/.mini', // build/instalace: dist/skeleton/.mini
  '../assets/skeleton/.mini', // dev/testy ze src: <repo>/assets/skeleton/.mini
] as const;

/** Jméno placeholderu, který v repu drží jinak prázdný adresář v gitu. Do
 * cílového projektu se NEkopíruje — `mini init/update` adresář jen `mkdir`nou. */
export const GITKEEP = '.gitkeep';

export interface SkeletonEntry {
  /** Cesta relativní ke kořeni skeletonu (`.mini/`), s nativním oddělovačem. */
  relPath: string;
  kind: 'dir' | 'file';
}

/** Absolutní cesta ke kořeni skeletonu (`.mini/`). Hodí první existující
 * kandidát; když není žádný, je něco rozbité (chybí build i repo asset). */
export async function skeletonDir(): Promise<string> {
  for (const rel of SKELETON_CANDIDATES) {
    const candidate = fileURLToPath(new URL(rel, import.meta.url));
    try {
      await access(candidate);
      return candidate;
    } catch {
      // zkus dalšího kandidáta
    }
  }
  throw new Error(
    'Skeleton .mini se nepodařilo najít (chybí dist/skeleton i assets/skeleton). Spusť `npm run build`.',
  );
}

/**
 * Vyjmenuje položky skeletonu (rekurzivně): adresáře i soubory, relativně ke
 * kořeni `.mini/`. `.gitkeep` přeskakuje — slouží jen k udržení prázdného
 * adresáře v gitu repa, do projektu nepatří. Adresář se do výstupu dostane i
 * když je v něm jen `.gitkeep` (vznikne z něj prázdný dir v projektu).
 */
export async function readSkeletonEntries(): Promise<SkeletonEntry[]> {
  const root = await skeletonDir();
  const entries: SkeletonEntry[] = [];

  async function walk(absDir: string): Promise<void> {
    const dirents = await readdir(absDir, { withFileTypes: true });
    for (const d of dirents) {
      const abs = join(absDir, d.name);
      if (d.isDirectory()) {
        entries.push({ relPath: relative(root, abs), kind: 'dir' });
        await walk(abs);
      } else if (d.isFile()) {
        if (d.name === GITKEEP) continue;
        entries.push({ relPath: relative(root, abs), kind: 'file' });
      }
    }
  }

  await walk(root);
  return entries;
}
