import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readSkeletonEntries, skeletonDir } from '../assets.js';
import { log } from '../ui/log.js';

/** Project state directory — the root the skeleton is mirrored into. */
const STATE_DIR = '.mini';

export interface UpdateOptions {
  /** Preview only — write nothing, just print what would happen. */
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
 * Syncs the static `.mini/` skeleton (directories + `.gitignore`) into the project:
 * - creates missing directories (`.gitkeep` from the repo is not copied — see assets.ts),
 * - compares files by content and overwrites only those that differ (atomically tmp+rename),
 * - leaves the rest unchanged.
 *
 * Skeleton files are mini-owned, so update always brings them to the canonical
 * form (manual edits get overwritten — git handles that). Idempotent: on an
 * already synced project it writes nothing. With `dryRun` it only counts and
 * prints what would happen.
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

  // Directories first (so the parent exists for nested files), sorted by
  // depth/path so the parent is created before the child.
  const dirs = entries.filter((e) => e.kind === 'dir').sort((a, b) => a.relPath.localeCompare(b.relPath));
  for (const entry of dirs) {
    const target = join(cwd, STATE_DIR, entry.relPath);
    if (await pathExists(target)) continue;
    result.createdDirs++;
    log.success(dryRun ? `Directory will be created: ${join(STATE_DIR, entry.relPath)}` : `Created: ${join(STATE_DIR, entry.relPath)}/`);
    if (!dryRun) await mkdir(target, { recursive: true });
  }

  const files = entries.filter((e) => e.kind === 'file').sort((a, b) => a.relPath.localeCompare(b.relPath));
  for (const entry of files) {
    // We read the content from the source file on disk (`srcRelPath`), but write
    // it into the project under the target name (`relPath`) — these differ for
    // renamed files like `gitignore` → `.gitignore` (see assets.ts:FILE_RENAMES).
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
      log.success(dryRun ? `Will be created: ${rel}` : `Created: ${rel}`);
    } else {
      result.updatedFiles++;
      log.success(dryRun ? `Will change: ${rel}` : `Updated: ${rel}`);
    }
  }

  const unchanged = result.unchangedFiles;
  if (unchanged > 0) {
    log.dim(`${unchanged} skeleton ${unchanged === 1 ? 'file' : 'files'} unchanged.`);
  }

  return result;
}
