import { homedir } from 'node:os';
import { join } from 'node:path';
import { ask } from '../ui/ask.js';
import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';
import { COMMANDS_DIR, type WriteCommandsResult, writeCommandsTo } from './commands.js';
import { type ClaudeDetection, detectClaude, recommendedScope } from './detectClaude.js';
import { installStatusline } from './statuslineSettings.js';

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
    'Use them in Claude Code: /mini:init, /mini:next, /mini:discuss, /mini:plan, /mini:do, /mini:done, /mini:auto, /mini:status, /mini:map, /mini:audit, /mini:upgrade',
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

export interface OfferStatuslineOptions {
  /** Home directory; defaults to the real one. Injectable for tests. */
  home?: string;
  /** Whether we may prompt. Defaults to the TTY check; injectable for tests. */
  interactive?: boolean;
  /** Asks the yes/no question. Defaults to a `prompts` confirm; injectable for tests. */
  confirm?: () => Promise<boolean>;
}

/**
 * Offers to wire the mini status line into `~/.claude/settings.json`. Only does
 * anything when (a) there is a TTY and (b) the user has no `statusLine` yet — an
 * existing one (the user's, GSD's, Claude's) is never touched. Asks for a yes/no
 * first, so the install stays opt-in. Safe to call from postinstall: returns
 * quietly without a TTY and prints a hint when the user declines.
 */
export async function offerStatusline(options: OfferStatuslineOptions = {}): Promise<void> {
  const interactive = options.interactive ?? isInteractive();
  if (!interactive) return; // no TTY → skip silently

  // Peek without writing: if a statusLine already exists, leave it and don't ask.
  const preview = await installStatusline({ home: options.home, dryRun: true });
  if (!preview.changed) return;

  const confirm = options.confirm ?? defaultStatuslineConfirm;
  if (!(await confirm())) {
    log.hint('Skipped the status line. Add it later via ~/.claude/settings.json.');
    return;
  }

  const res = await installStatusline({ home: options.home });
  if (res.changed) {
    log.success('Installed the mini status line into ~/.claude/settings.json.');
    log.hint('Disable it anytime by removing the "statusLine" block from that file.');
  }
}

async function defaultStatuslineConfirm(): Promise<boolean> {
  const res = await ask({
    type: 'confirm',
    name: 'ok',
    message:
      'Show a mini status line in Claude Code (project dir, model, context-window usage)?',
    initial: true,
  });
  return (res as { ok?: boolean }).ok === true;
}
