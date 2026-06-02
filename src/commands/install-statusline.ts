import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import {
  installStatusline,
  isMiniStatusline,
  userSettingsPath,
} from '../install/statuslineSettings.js';
import { log } from '../ui/log.js';

export interface InstallStatuslineCmdOptions {
  /** Home directory; defaults to the real one. Injectable for tests. */
  home?: string;
  /** Preview only — print what would happen, change nothing. */
  dryRun?: boolean;
}

/** Reads the current `statusLine` entry from settings.json, or undefined. */
async function readStatusLine(path: string): Promise<unknown> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8'));
    if (typeof parsed === 'object' && parsed !== null) {
      return (parsed as { statusLine?: unknown }).statusLine;
    }
  } catch {
    // Missing or malformed file → no status line.
  }
  return undefined;
}

/**
 * Enables the mini status line by adding a `statusLine` block to
 * `~/.claude/settings.json` (via `installStatusline`). The install counterpart to
 * `mini uninstall`: opt-in, since a global install never wires the status line on
 * its own. Never overwrites an existing status line — a foreign one is left
 * untouched, and an already-present mini one is reported as a no-op. `--dry-run`
 * previews without writing.
 */
export async function installStatuslineCommand(
  options: InstallStatuslineCmdOptions = {},
): Promise<void> {
  const home = options.home ?? homedir();
  const path = userSettingsPath(home);

  // Classify the current state up front so the summary is precise.
  const existing = await readStatusLine(path);
  if (existing !== undefined && existing !== null) {
    if (isMiniStatusline(existing)) {
      log.info(`The mini status line is already enabled in ${path}.`);
    } else {
      log.info(`A non-mini status line is set in ${path} — leaving it untouched.`);
      log.hint('Remove it first (e.g. delete the "statusLine" block) if you want mini\'s instead.');
    }
    return;
  }

  if (options.dryRun) {
    log.title('mini install-statusline will:');
    log.info(`  - add the mini status line to ${path}`);
    log.dim('Dry run — nothing was changed.');
    return;
  }

  const res = await installStatusline({ home });
  if (res.changed) {
    log.success(`Enabled the mini status line in ${res.path}.`);
    log.hint('It shows the project dir, model, and context-window usage in Claude Code.');
    log.hint('Disable it anytime with: mini uninstall (or remove the "statusLine" block).');
  } else {
    // Defensive: the checks above should have handled this.
    log.info(`A status line is already set in ${res.path} — left as-is.`);
  }
}
