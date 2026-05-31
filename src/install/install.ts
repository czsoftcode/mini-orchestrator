import { homedir } from 'node:os';
import { join } from 'node:path';
import { ask } from '../ui/ask.js';
import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';
import { COMMANDS_DIR, type WriteCommandsResult, writeCommandsTo } from './commands.js';
import { type ClaudeDetection, detectClaude, recommendedScope } from './detectClaude.js';

/** Where the slash commands get installed. */
export type InstallScope = 'project' | 'user';

export interface ResolvedTarget {
  scope: InstallScope;
  /** Absolute path of the `.claude/commands/mini` directory. */
  dir: string;
  /** Short, human-readable form for log lines (`~/.claude/...` or the relative project path). */
  displayDir: string;
}

/** The user-level commands dir, `~/.claude/commands/mini`. */
export function userCommandsDir(home: string = homedir()): string {
  return join(home, COMMANDS_DIR);
}

/** Resolves a scope to concrete absolute + display paths. */
export function resolveTarget(scope: InstallScope, cwd: string = process.cwd()): ResolvedTarget {
  if (scope === 'user') {
    return {
      scope,
      dir: userCommandsDir(),
      displayDir: join('~', COMMANDS_DIR),
    };
  }
  return {
    scope,
    dir: join(cwd, COMMANDS_DIR),
    displayDir: COMMANDS_DIR,
  };
}

export interface InstallOptions {
  cwd?: string;
  /** Explicit scope. When omitted, ask interactively (TTY) or fall back to the detected default. */
  scope?: InstallScope;
  dryRun?: boolean;
  /** Detection result to base the default/prompt on. Computed when omitted (injectable for tests). */
  detection?: ClaudeDetection;
}

export interface InstallResult extends WriteCommandsResult {
  target: ResolvedTarget;
}

/**
 * Installs the `/mini:*` slash commands into the chosen location and prints a
 * summary + usage hint. The scope is decided as follows:
 * - an explicit `scope` wins,
 * - otherwise, with a TTY, the user is asked (default = the detected scope),
 * - without a TTY, the detected default is used silently.
 *
 * Shares the actual writing with `writeCommandsTo`, so the output matches the
 * project installer and the postinstall hook.
 */
export async function installSlashCommands(options: InstallOptions = {}): Promise<InstallResult> {
  const cwd = options.cwd ?? process.cwd();
  const detection = options.detection ?? detectClaude({ cwd });
  const scope = options.scope ?? (await chooseScope(detection));
  const target = resolveTarget(scope, cwd);

  const result = await writeCommandsTo(target.dir, {
    dryRun: options.dryRun,
    displayDir: target.displayDir,
  });

  const total = result.created + result.updated + result.unchanged;
  log.success(
    `Done — ${total} commands in ${target.displayDir}/ (${result.created} new, ${result.updated} changed).`,
  );
  log.hint(
    'Use them in Claude Code: /mini:init, /mini:next, /mini:discuss, /mini:plan, /mini:do, /mini:done, /mini:auto, /mini:status, /mini:map, /mini:audit',
  );

  return { ...result, target };
}

/**
 * Picks the install scope: when interactive, asks (default = detected scope);
 * otherwise returns the detected default without prompting.
 */
async function chooseScope(detection: ClaudeDetection): Promise<InstallScope> {
  const recommended = recommendedScope(detection);
  if (!isInteractive()) {
    return recommended;
  }

  const userDir = join('~', COMMANDS_DIR);
  const projectChoice = { title: `This project (${COMMANDS_DIR})`, value: 'project' as const };
  const userChoice = { title: `All projects (${userDir})`, value: 'user' as const };
  // Put the recommended option first so Enter accepts it.
  const choices = recommended === 'user' ? [userChoice, projectChoice] : [projectChoice, userChoice];

  const { scope } = await ask<'scope'>({
    type: 'select',
    name: 'scope',
    message: 'Where to install the /mini:* slash commands?',
    choices,
  });
  return (scope as InstallScope) ?? recommended;
}
