import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readSkeletonEntries, skeletonDir } from '../assets.js';
import { exists } from '../state/store.js';
import { log } from '../ui/log.js';
import { installCommands } from './install-commands.js';
import type { StepOutcome } from './types.js';

/** Adresář stavu v projektu — kořen, do kterého se skeleton zrcadlí. */
const STATE_DIR = '.mini';

export interface UpdateOptions {
  /** Jen náhled — nic nezapisuj, jen vypiš, co by se stalo. */
  dryRun?: boolean;
}

export interface SkeletonSyncResult {
  createdDirs: number;
  createdFiles: number;
  updatedFiles: number;
  unchangedFiles: number;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Srovná statický skeleton `.mini/` (adresáře + `.gitignore`) do projektu:
 * - chybějící adresáře vytvoří (`.gitkeep` z repa se nekopíruje — viz assets.ts),
 * - soubory porovná obsahově a přepíše jen ty, co se liší (atomicky tmp+rename),
 * - ostatní nechá beze změny.
 *
 * Skeleton soubory jsou mini-owned, takže update je vždy srovná na kanonickou
 * podobu (ruční úpravy přepíše — řeší git). Idempotentní: na už srovnaném
 * projektu nic nezapíše. S `dryRun` jen spočítá a vypíše, co by se stalo.
 */
export async function syncSkeleton(
  cwd: string = process.cwd(),
  { dryRun = false }: UpdateOptions = {},
): Promise<SkeletonSyncResult> {
  const root = await skeletonDir();
  const entries = await readSkeletonEntries();

  const result: SkeletonSyncResult = {
    createdDirs: 0,
    createdFiles: 0,
    updatedFiles: 0,
    unchangedFiles: 0,
  };

  // Adresáře nejdřív (ať existuje rodič pro vnořené soubory), seřazené podle
  // hloubky/cesty, aby se rodič založil před potomkem.
  const dirs = entries.filter((e) => e.kind === 'dir').sort((a, b) => a.relPath.localeCompare(b.relPath));
  for (const entry of dirs) {
    const target = join(cwd, STATE_DIR, entry.relPath);
    if (await pathExists(target)) continue;
    result.createdDirs++;
    log.success(dryRun ? `Vznikne adresář: ${join(STATE_DIR, entry.relPath)}` : `Vytvořeno: ${join(STATE_DIR, entry.relPath)}/`);
    if (!dryRun) await mkdir(target, { recursive: true });
  }

  const files = entries.filter((e) => e.kind === 'file').sort((a, b) => a.relPath.localeCompare(b.relPath));
  for (const entry of files) {
    // Obsah čteme ze zdrojového souboru na disku (`srcRelPath`), ale do projektu
    // zapisujeme pod cílovým jménem (`relPath`) — liší se u přejmenovaných
    // souborů jako `gitignore` → `.gitignore` (viz assets.ts:FILE_RENAMES).
    const content = await readFile(join(root, entry.srcRelPath), 'utf-8');
    const target = join(cwd, STATE_DIR, entry.relPath);
    const rel = join(STATE_DIR, entry.relPath);

    let old: string | null = null;
    try {
      old = await readFile(target, 'utf-8');
    } catch {
      old = null;
    }

    if (old === content) {
      result.unchangedFiles++;
      continue;
    }

    if (!dryRun) {
      await mkdir(dirname(target), { recursive: true });
      const tmp = `${target}.tmp`;
      await writeFile(tmp, content, 'utf-8');
      await rename(tmp, target);
    }

    if (old === null) {
      result.createdFiles++;
      log.success(dryRun ? `Vznikne: ${rel}` : `Vytvořeno: ${rel}`);
    } else {
      result.updatedFiles++;
      log.success(dryRun ? `Změní se: ${rel}` : `Aktualizováno: ${rel}`);
    }
  }

  const unchanged = result.unchangedFiles;
  if (unchanged > 0) {
    log.dim(`${unchanged} ${unchanged === 1 ? 'soubor skeletonu beze změny' : 'souborů skeletonu beze změny'}.`);
  }

  return result;
}

/**
 * `mini update` — srovná negenerovanou část projektu na aktuální verzi mini:
 * statický skeleton `.mini/` (adresáře + `.gitignore`) a slash commandy
 * `.claude/commands/mini/*.md`. Idempotentní; s `--dry-run` jen ukáže náhled.
 *
 * Záměrně NEsahá na generované/per-projekt soubory (`project.md`, `state.json`,
 * `phases/`, `graph/`, …) ani neprovádí jednorázové migrace (`mini migrate`).
 */
export async function update(
  cwd: string = process.cwd(),
  { dryRun = false }: UpdateOptions = {},
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt (.mini/state.json).');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  log.title(dryRun ? 'mini update — náhled (nic se nezapíše)' : 'mini update');

  log.info('Skeleton .mini/:');
  const skel = await syncSkeleton(cwd, { dryRun });

  console.log();
  log.info('Slash commandy:');
  const cmds = await installCommands(cwd, { dryRun });

  const changed =
    skel.createdDirs + skel.createdFiles + skel.updatedFiles + cmds.created + cmds.updated;

  console.log();
  if (changed === 0) {
    log.success('Projekt je aktuální — nic k doplnění.');
  } else if (dryRun) {
    log.success(`Náhled: ${changed} ${changed === 1 ? 'položka' : 'položek'} k srovnání. Spusť bez --dry-run pro zápis.`);
  } else {
    log.success(`Hotovo — projekt srovnán na aktuální verzi mini (${changed} ${changed === 1 ? 'změna' : 'změn'}).`);
  }

  return { ok: true };
}
