import {
  buildGraph,
  GRAPH_DIR,
  GRAPH_INDEX,
  hasMappableProject,
  updateGraphFile,
} from '../graph/buildGraph.js';
import { exists } from '../state/store.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/**
 * `mini map` — regenerates the machine-readable project map into `.mini/graph/`
 * (one file per source file) + the index `.mini/graph.json`.
 *
 * Detects a mappable project (tsconfig.json/Cargo.toml/composer.json/… or at
 * least one `.ts`/`.tsx`/`.php`/`.rs`/`.py`/`.go`/`.java`/`.cs`/`.kt`/`.kts`/`.swift`/`.rb`/`.c`/`.h`/`.cpp`/`.hpp`/`.cc`/`.hh` file)
 * and otherwise just hints to the user to run `/graphify` in a Claude session.
 */
export async function map(files?: string[]): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    // In --file (hook) mode stay quiet — the hook may fire outside a mini project too.
    if (files && files.length > 0) return { ok: false, reason: 'no-project' };
    log.warn('There is no project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  // Incremental path: remap only the given files (node + index record).
  if (files && files.length > 0) {
    return mapFiles(cwd, files);
  }

  if (!(await hasMappableProject(cwd))) {
    log.warn(
      'There are no mappable files in the project (.ts, .tsx, .php, .rs, .py, .go, .java, .cs, .kt, .kts, .swift, .rb, .c, .h, .cpp, .hpp, .cc, .hh).',
    );
    log.hint('For other languages try in a Claude session: /graphify');
    return { ok: false, reason: 'not-mappable' };
  }

  log.dim('Mapping TS/PHP/Rust/Python/Go/Java/C#/Kotlin/Swift/Ruby/C/C++ files…');
  const result = await buildGraph(cwd);

  if (result.fileCount === 0) {
    log.warn(`${GRAPH_INDEX} written, but no mappable files were found.`);
    return { ok: true };
  }

  const word = result.fileCount === 1 ? 'file' : 'files';
  log.success(`${GRAPH_DIR}/ + ${GRAPH_INDEX}: ${result.fileCount} ${word}.`);
  return { ok: true };
}

/**
 * Incrementally remaps the given files via `updateGraphFile` and prints a short
 * summary. An error on one file does not spoil the others — the hook must not crash.
 */
async function mapFiles(cwd: string, files: string[]): Promise<StepOutcome> {
  let updated = 0;
  let removed = 0;
  let skipped = 0;
  let fellBack = false;

  for (const file of files) {
    try {
      const res = await updateGraphFile(cwd, file);
      switch (res.status) {
        case 'updated':
          updated += 1;
          break;
        case 'removed':
          removed += 1;
          break;
        case 'skipped':
          skipped += 1;
          break;
        case 'fell-back':
          fellBack = true;
          break;
      }
    } catch (err) {
      log.warn(`Failed to remap ${file}: ${(err as Error).message}`);
    }
  }

  // A fallback means a full rebuild of the whole graph (a missing/corrupted index).
  if (fellBack) {
    log.success(`${GRAPH_INDEX} was missing → full graph rebuild.`);
    return { ok: true };
  }

  const parts: string[] = [];
  if (updated > 0) parts.push(`${updated} updated`);
  if (removed > 0) parts.push(`${removed} removed`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  log.success(`Graph: ${parts.length > 0 ? parts.join(', ') : 'no change'}.`);
  return { ok: true };
}
