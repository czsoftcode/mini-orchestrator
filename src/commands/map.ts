import { buildGraph, GRAPH_FILE, isTypeScriptProject } from '../graph/buildGraph.js';
import { exists } from '../state/store.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';

/**
 * `mini map` — přegeneruje strojovou mapu projektu (`.mini/graph.md`).
 *
 * Detekuje TS projekt (tsconfig.json nebo aspoň jeden `.ts`/`.tsx` soubor)
 * a v ostatních případech jen tipne uživateli, ať si pustí `/graphify`
 * v Claude session (vlastní mapper umí jen TS).
 */
export async function map(): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  if (!(await isTypeScriptProject(cwd))) {
    log.warn('Tohle není TypeScript projekt — vlastní TS mapper nemá co mapovat.');
    log.hint('Pro jiné jazyky zkus v Claude session: /graphify');
    return { ok: false, reason: 'not-typescript' };
  }

  log.dim('Mapuji TS/TSX soubory…');
  const result = await buildGraph(cwd);

  if (result.fileCount === 0) {
    log.warn(`${GRAPH_FILE} zapsán, ale žádné TS/TSX soubory nebyly nalezeny.`);
    return { ok: true };
  }

  const word = result.fileCount === 1 ? 'soubor' : result.fileCount < 5 ? 'soubory' : 'souborů';
  log.success(`${GRAPH_FILE}: ${result.fileCount} ${word}.`);
  return { ok: true };
}
