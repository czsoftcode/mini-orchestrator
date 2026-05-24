import { readdir } from 'node:fs/promises';

/**
 * Adresáře a soubory, které při detekci brownfieldu nepočítají jako "kód".
 * Patří sem cache buildů, runtime artefakty a `.mini/` samotné. Bez filtrace
 * by čerstvě klonovaný git nebo `mini init` v prázdném adresáři po `mini init`
 * mylně hlásil brownfield.
 */
export const BROWNFIELD_IGNORED: ReadonlySet<string> = new Set([
  '.git',
  '.mini',
  '.planning',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  '.turbo',
  'coverage',
  '.DS_Store',
]);

/**
 * Brownfield = v `cwd` existuje cokoli, co nepatří do `BROWNFIELD_IGNORED`.
 * Heuristika je záměrně naivní — `mini audit` pak sám zjistí, co tam reálně je.
 */
export async function isBrownfield(cwd: string): Promise<boolean> {
  let entries: string[];
  try {
    entries = await readdir(cwd);
  } catch {
    return false;
  }
  return entries.some((name) => !BROWNFIELD_IGNORED.has(name));
}
