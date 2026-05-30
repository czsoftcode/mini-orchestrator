import { rm, writeFile } from 'node:fs/promises';
import { exists, stopPath } from '../state/store.js';
import { log } from '../ui/log.js';

export interface StopOptions {
  /** Smaže stop signál místo jeho založení. */
  clear?: boolean;
}

/**
 * Kooperativní stop pro autonomní `/mini:auto`.
 *
 * Bez flagu založí soubor `.mini/STOP` — autonomní běh ho na svých kontrolních
 * bodech přečte, dokončí rozdělaný krok, zapíše report a čistě skončí. Tvrdé
 * přerušení uprostřed kroku je dál na Esc/Ctrl+C.
 *
 * S `--clear` signál smaže, aby další `/mini:auto` zase běžel.
 *
 * Obě varianty jsou idempotentní (opakované volání nic nerozbije).
 */
export async function stop(opts: StopOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    return;
  }

  const path = stopPath(cwd);

  if (opts.clear) {
    await rm(path, { force: true });
    log.success('Stop signál smazán — autonomní /mini:auto zase poběží.');
    return;
  }

  await writeFile(path, `${new Date().toISOString()}\n`, 'utf-8');
  log.success('Stop signál založen (.mini/STOP).');
  log.hint('Autonomní /mini:auto dokončí rozdělaný krok a čistě skončí.');
  log.hint('Zrušíš ho příkazem `mini stop --clear`.');
}
