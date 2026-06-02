import { access, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { COMMANDS_DIR } from '../install/commands.js';
import { userCommandsDir } from '../install/install.js';
import {
  removeStatuslineFromSettings,
  userSettingsPath,
} from '../install/statuslineSettings.js';
import { ask } from '../ui/ask.js';
import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';

export interface UninstallOptions {
  /** Project root to look for project-scope commands in. Defaults to cwd. */
  cwd?: string;
  /** Home directory; defaults to the real one. Injectable for tests. */
  home?: string;
  /** Preview only — print what would be removed, change nothing. */
  dryRun?: boolean;
  /** Skip the confirmation prompt. */
  yes?: boolean;
  /** Asks the yes/no question. Injectable for tests; defaults to a `prompts` confirm. */
  confirm?: () => Promise<boolean>;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function defaultConfirm(): Promise<boolean> {
  const res = await ask({
    type: 'confirm',
    name: 'ok',
    message: 'Remove the items listed above?',
    initial: false,
  });
  return (res as { ok?: boolean }).ok === true;
}

/**
 * Removes everything mini wrote outside the project tree: the `/mini:*` slash
 * commands (user scope `~/.claude/commands/mini` and, when present, the
 * project-scope `.claude/commands/mini`) and mini's own status line from
 * `~/.claude/settings.json`. A foreign status line is left intact. Symmetric to
 * the install / postinstall so an evaluator can fully clean up after
 * `npm uninstall -g mini-orchestrator`.
 */
export async function uninstall(options: UninstallOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? homedir();
  const dryRun = options.dryRun ?? false;

  const userDir = userCommandsDir(home);
  const projectDir = join(cwd, COMMANDS_DIR);

  const userExists = await pathExists(userDir);
  const projectExists = await pathExists(projectDir);
  // Peek at the status-line removal without writing, to build the action list.
  const slPreview = await removeStatuslineFromSettings({ home, dryRun: true });

  const actions: string[] = [];
  if (userExists) actions.push(`remove ${join('~', COMMANDS_DIR)}`);
  if (projectExists) actions.push(`remove ${COMMANDS_DIR} (this project)`);
  if (slPreview.changed) actions.push('remove the mini status line from ~/.claude/settings.json');

  if (actions.length === 0) {
    log.info('Nothing to remove — mini left no slash commands or status line behind.');
    return;
  }

  log.title('mini uninstall will:');
  for (const a of actions) log.info(`  - ${a}`);
  if (slPreview.reason === 'foreign') {
    log.hint('A non-mini status line in ~/.claude/settings.json is left untouched.');
  }

  if (dryRun) {
    log.dim('Dry run — nothing was changed.');
    return;
  }

  if (!options.yes) {
    const confirmFn = options.confirm ?? (isInteractive() ? defaultConfirm : undefined);
    if (!confirmFn) {
      log.warn('No terminal to confirm. Re-run with --yes to remove without prompting.');
      return;
    }
    if (!(await confirmFn())) {
      log.dim('Cancelled.');
      return;
    }
  }

  if (userExists) await rm(userDir, { recursive: true, force: true });
  if (projectExists) await rm(projectDir, { recursive: true, force: true });
  const slResult = slPreview.changed ? await removeStatuslineFromSettings({ home }) : slPreview;

  log.success('Removed mini.');
  if (userExists) log.hint(`Deleted ${join('~', COMMANDS_DIR)}`);
  if (projectExists) log.hint(`Deleted ${COMMANDS_DIR}`);
  if (slResult.changed) log.hint(`Removed the status line from ${userSettingsPath(home)}`);
  log.hint('To remove the package itself: npm uninstall -g mini-orchestrator');
}
