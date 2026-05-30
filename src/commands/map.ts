import { buildGraph, GRAPH_DIR, GRAPH_INDEX, hasMappableProject } from '../graph/buildGraph.js';
import { exists } from '../state/store.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/**
 * `mini map` — přegeneruje strojovou mapu projektu do `.mini/graph/`
 * (jeden soubor na zdroják) + index `.mini/graph.json`.
 *
 * Detekuje mapovatelný projekt (tsconfig.json/Cargo.toml/composer.json/… nebo
 * aspoň jeden `.ts`/`.tsx`/`.php`/`.rs`/`.py`/`.go`/`.java`/`.cs` soubor)
 * a v ostatních případech jen tipne uživateli, ať si pustí `/graphify`
 * v Claude session.
 */
export async function map(): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  if (!(await hasMappableProject(cwd))) {
    log.warn(
      'V projektu nejsou žádné mapovatelné soubory (.ts, .tsx, .php, .rs, .py, .go, .java, .cs).',
    );
    log.hint('Pro jiné jazyky zkus v Claude session: /graphify');
    return { ok: false, reason: 'not-mappable' };
  }

  log.dim('Mapuji TS/PHP/Rust/Python/Go/Java/C# soubory…');
  const result = await buildGraph(cwd);

  if (result.fileCount === 0) {
    log.warn(`${GRAPH_INDEX} zapsán, ale žádné mapovatelné soubory nebyly nalezeny.`);
    return { ok: true };
  }

  const word = result.fileCount === 1 ? 'soubor' : result.fileCount < 5 ? 'soubory' : 'souborů';
  log.success(`${GRAPH_DIR}/ + ${GRAPH_INDEX}: ${result.fileCount} ${word}.`);
  return { ok: true };
}
