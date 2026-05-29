import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Úroveň navýšení semver verze. */
export type BumpLevel = 'patch' | 'minor' | 'major';

export const BUMP_LEVELS: readonly BumpLevel[] = ['patch', 'minor', 'major'];

export function isBumpLevel(value: string): value is BumpLevel {
  return (BUMP_LEVELS as readonly string[]).includes(value);
}

export interface BumpResult {
  from: string;
  to: string;
}

/**
 * Navýší `x.y.z` část verze podle úrovně. Případný prerelease/build suffix
 * (`-beta`, `+build`) zahodíme — orchestrátor verzuje releasy fází, ne kanály.
 */
export function bumpSemver(version: string, level: BumpLevel): string | null {
  const m = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (level === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (level === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

/**
 * Navýší verzi v `package.json` v `cwd` podle `level` a zapíše ji zpět.
 *
 * Zápis je **textová náhrada** jen hodnoty u `"version"` — formátování souboru
 * (odsazení, koncový newline, pořadí klíčů) zůstane beze změny, takže diff
 * obsahuje jediný řádek. Záměrně nepoužíváme `npm version` (dělá vlastní
 * commit/tag) ani `JSON.parse`/`stringify` (přeformátoval by celý soubor).
 *
 * Vrací `null` (a nic nezapíše), když:
 * - `package.json` neexistuje (jiný jazyk projektu — řeší se per projekt jinde),
 * - nemá pole `version`, nebo verze není ve tvaru `x.y.z`.
 *
 * Nikdy nehází kvůli chybějícímu souboru — to je očekávaný stav, ne chyba.
 */
export async function bumpPackageVersion(
  cwd: string,
  level: BumpLevel = 'patch',
): Promise<BumpResult | null> {
  const path = join(cwd, 'package.json');

  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    return null;
  }

  const m = raw.match(/("version"\s*:\s*")([^"]+)(")/);
  if (!m) return null;
  const from = m[2]!;
  const to = bumpSemver(from, level);
  if (!to) return null;

  const next = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${to}$2`);
  await writeFile(path, next, 'utf-8');

  return { from, to };
}
