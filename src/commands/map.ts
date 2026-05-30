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
 * `mini map` — přegeneruje strojovou mapu projektu do `.mini/graph/`
 * (jeden soubor na zdroják) + index `.mini/graph.json`.
 *
 * Detekuje mapovatelný projekt (tsconfig.json/Cargo.toml/composer.json/… nebo
 * aspoň jeden `.ts`/`.tsx`/`.php`/`.rs`/`.py`/`.go`/`.java`/`.cs`/`.kt`/`.kts`/`.swift`/`.rb` soubor)
 * a v ostatních případech jen tipne uživateli, ať si pustí `/graphify`
 * v Claude session.
 */
export async function map(files?: string[]): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    // V --file (hook) režimu drž hubu — hook může vyletět i mimo mini projekt.
    if (files && files.length > 0) return { ok: false, reason: 'no-project' };
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  // Inkrementální cesta: přemapuj jen zadané soubory (uzel + záznam v indexu).
  if (files && files.length > 0) {
    return mapFiles(cwd, files);
  }

  if (!(await hasMappableProject(cwd))) {
    log.warn(
      'V projektu nejsou žádné mapovatelné soubory (.ts, .tsx, .php, .rs, .py, .go, .java, .cs, .kt, .kts, .swift, .rb).',
    );
    log.hint('Pro jiné jazyky zkus v Claude session: /graphify');
    return { ok: false, reason: 'not-mappable' };
  }

  log.dim('Mapuji TS/PHP/Rust/Python/Go/Java/C#/Kotlin/Swift/Ruby soubory…');
  const result = await buildGraph(cwd);

  if (result.fileCount === 0) {
    log.warn(`${GRAPH_INDEX} zapsán, ale žádné mapovatelné soubory nebyly nalezeny.`);
    return { ok: true };
  }

  const word = result.fileCount === 1 ? 'soubor' : result.fileCount < 5 ? 'soubory' : 'souborů';
  log.success(`${GRAPH_DIR}/ + ${GRAPH_INDEX}: ${result.fileCount} ${word}.`);
  return { ok: true };
}

/**
 * Inkrementálně přemapuje zadané soubory přes `updateGraphFile` a vypíše krátké
 * shrnutí. Chyba u jednoho souboru nezhatí ostatní — hook nesmí spadnout.
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
      log.warn(`Nepodařilo se přemapovat ${file}: ${(err as Error).message}`);
    }
  }

  // Fallback znamená plný rebuild celého grafu (chyběl/poškozený index).
  if (fellBack) {
    log.success(`${GRAPH_INDEX} chyběl → plný rebuild grafu.`);
    return { ok: true };
  }

  const parts: string[] = [];
  if (updated > 0) parts.push(`${updated} aktualizováno`);
  if (removed > 0) parts.push(`${removed} odebráno`);
  if (skipped > 0) parts.push(`${skipped} přeskočeno`);
  log.success(`Graf: ${parts.length > 0 ? parts.join(', ') : 'beze změny'}.`);
  return { ok: true };
}
