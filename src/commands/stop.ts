import { rm, writeFile } from 'node:fs/promises';
import { exists, stopPath } from '../state/store.js';
import { log } from '../ui/log.js';

export interface StopOptions {
  /** Removes the stop signal instead of creating it. */
  clear?: boolean;
}

/**
 * Cooperative stop for the autonomous `/mini:auto`.
 *
 * Without a flag it creates the file `.mini/STOP` — the autonomous run reads it at
 * its checkpoints, finishes the current step, writes a report and exits cleanly.
 * A hard interrupt mid-step is still Esc/Ctrl+C.
 *
 * With `--clear` it removes the signal so the next `/mini:auto` runs again.
 *
 * Both variants are idempotent (repeated calls break nothing).
 */
export async function stop(opts: StopOptions = {}): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('There is no project in this directory.');
    return;
  }

  const path = stopPath(cwd);

  if (opts.clear) {
    await rm(path, { force: true });
    log.success('Stop signal removed — the autonomous /mini:auto will run again.');
    return;
  }

  await writeFile(path, `${new Date().toISOString()}\n`, 'utf-8');
  log.success('Stop signal created (.mini/STOP).');
  log.hint('The autonomous /mini:auto will finish the current step and exit cleanly.');
  log.hint('Remove it with `mini stop --clear`.');
}
