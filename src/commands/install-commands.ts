import { join } from 'node:path';
import {
  COMMANDS_DIR,
  type WriteCommandsResult,
  writeCommandsTo,
} from '../install/commands.js';
import { log } from '../ui/log.js';

// Re-export the generator pieces so existing imports (and tests) keep working.
export { COMMANDS_DIR, renderCommandMd } from '../install/commands.js';
export type { CommandDef } from '../install/commands.js';

export interface InstallCommandsOptions {
  /** Preview only — write nothing, return the counts as if it had been written. */
  dryRun?: boolean;
}

export type InstallCommandsResult = WriteCommandsResult;

/**
 * Generates `.claude/commands/mini/*.md` into the current **project**. Idempotent:
 * can be run repeatedly, overwrites only what differs, and prints what was created
 * / updated / left unchanged. With `dryRun` it only counts and prints what would
 * happen, without touching the disk.
 *
 * The actual writing is delegated to the shared `writeCommandsTo`; this wrapper
 * adds the project-scoped summary line and the usage hint. It is used by
 * `mini update` and by the hidden manual-install fallback.
 */
export async function installCommands(
  cwd: string = process.cwd(),
  { dryRun = false }: InstallCommandsOptions = {},
): Promise<InstallCommandsResult> {
  const targetDir = join(cwd, COMMANDS_DIR);
  const result = await writeCommandsTo(targetDir, { dryRun, displayDir: COMMANDS_DIR });

  const total = result.created + result.updated + result.unchanged;
  log.success(
    `Done — ${total} commands in ${COMMANDS_DIR}/ (${result.created} new, ${result.updated} changed).`,
  );
  log.hint(
    'Use them in Claude Code: /mini:init, /mini:next, /mini:discuss, /mini:plan, /mini:do, /mini:done, /mini:auto, /mini:status, /mini:map, /mini:audit',
  );

  return result;
}
