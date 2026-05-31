/**
 * Wiring the mini status line into Claude Code's user settings.
 *
 * Claude Code reads `~/.claude/settings.json` and runs whatever `statusLine`
 * points at. We add our own command there — but only when the user has NO
 * statusLine yet. That single rule satisfies both requirements at once:
 *   - it never overwrites a foreign status line (the user's, GSD's, Claude's),
 *   - it is idempotent: once a (mini or other) statusLine exists, a re-run sees
 *     it present and changes nothing, so it can't duplicate the entry.
 *
 * The merge is a pure function over the parsed settings object; the IO wrapper
 * reads/writes the file, preserves the other keys and a 2-space indent, and
 * creates the file when missing.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The user-level settings file Claude Code reads. */
export function userSettingsPath(home: string = homedir()): string {
  return join(home, '.claude', 'settings.json');
}

/**
 * The command string written into `statusLine.command`. Defaults to an absolute
 * `node <mini cli.js> statusline` invocation resolved from this module's
 * location, so it works for both global and project-local installs (it does not
 * rely on `mini` being on PATH). After the build this module sits at
 * `dist/install/`, with the CLI entry at `dist/cli.js`.
 */
export function miniStatuslineCommand(): string {
  const cliPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.js');
  return `node "${cliPath}" statusline`;
}

/** Shape of the statusLine entry Claude Code expects. */
export interface StatusLineEntry {
  type: 'command';
  command: string;
}

type Settings = Record<string, unknown> & { statusLine?: unknown };

export type MergeReason = 'added' | 'exists';

export interface MergeResult {
  settings: Settings;
  changed: boolean;
  reason: MergeReason;
}

/**
 * Returns the settings object with our statusLine added, but only if none is
 * present. When a `statusLine` already exists (whatever it is) the object is
 * returned untouched. Pure — does no IO.
 */
export function mergeStatusline(settings: Settings, command: string): MergeResult {
  if (settings.statusLine !== undefined && settings.statusLine !== null) {
    return { settings, changed: false, reason: 'exists' };
  }
  const entry: StatusLineEntry = { type: 'command', command };
  return { settings: { ...settings, statusLine: entry }, changed: true, reason: 'added' };
}

export interface InstallStatuslineOptions {
  /** Home directory; defaults to the real one. Injectable for tests. */
  home?: string;
  /** The command to register; defaults to `miniStatuslineCommand()`. */
  command?: string;
  /** Preview only — compute the result but write nothing. */
  dryRun?: boolean;
}

export interface InstallStatuslineResult {
  changed: boolean;
  reason: MergeReason;
  /** Absolute path of the settings file that was (or would be) written. */
  path: string;
  /** The command that was (or would be) registered. */
  command: string;
}

/**
 * Reads `~/.claude/settings.json` (treating a missing or unparseable file as an
 * empty object), adds the mini statusLine when absent, and writes the result
 * back with a trailing newline and 2-space indentation, preserving every other
 * key. With `dryRun` it computes the outcome but touches no files.
 */
export async function installStatusline(
  options: InstallStatuslineOptions = {},
): Promise<InstallStatuslineResult> {
  const home = options.home ?? homedir();
  const command = options.command ?? miniStatuslineCommand();
  const path = userSettingsPath(home);

  let current: Settings = {};
  try {
    current = JSON.parse(await readFile(path, 'utf-8')) as Settings;
    if (typeof current !== 'object' || current === null) current = {};
  } catch {
    // Missing or malformed file → start from an empty object.
    current = {};
  }

  const merged = mergeStatusline(current, command);

  if (merged.changed && !options.dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(merged.settings, null, 2)}\n`, 'utf-8');
  }

  return { changed: merged.changed, reason: merged.reason, path, command };
}
