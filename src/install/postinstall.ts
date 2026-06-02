import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';
import { installSlashCommands, offerStatusline } from './install.js';

/** The command users can run by hand to (re)install the slash commands. */
export const MANUAL_HINT =
  'Install the /mini:* slash commands anytime with:  mini install-commands  (or: npx mini install-commands)';

/**
 * Is this a global install (`npm i -g`)? npm sets `npm_config_global=true` for
 * the lifecycle scripts of a global install. We use it to decide whether to set
 * things up automatically even without a TTY: a global install is an explicit,
 * user-wide intent, whereas a local (project / CI) install should stay quiet.
 *
 * `env` is injectable so tests don't have to mutate `process.env`.
 */
export function isGlobalInstall(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.npm_config_global === 'true';
}

/**
 * npm `postinstall` entry. Runs after `npm install` of the package (invoked by
 * the guarded launcher `scripts/postinstall.mjs`, which calls this function).
 *
 * Safety first: this must NEVER fail the install. Without an interactive
 * terminal (CI, `npm ci`, piped install) it does nothing but print a short
 * hint — it never blocks waiting for input. With a TTY it offers to install the
 * slash commands (asking project vs user). Any error is caught and downgraded
 * to a warning so the install still succeeds.
 *
 * The target project is the directory where `npm install` was invoked, which npm
 * exposes as `INIT_CWD` (falling back to the current working directory).
 */
export async function runPostinstall(): Promise<void> {
  // Explicit opt-out for scripted installs / tests.
  if (process.env.MINI_SKIP_POSTINSTALL) {
    return;
  }

  const cwd = process.env.INIT_CWD ?? process.cwd();
  const interactive = isInteractive();

  // A global install (`npm i -g`) is an explicit, user-wide intent: install the
  // slash commands automatically even without a TTY (they are additive and
  // namespaced). The status line stays opt-in — we never silently edit the
  // user's settings.json. A local / CI install without a TTY stays quiet (only a
  // breadcrumb) so it never surprises a scripted install.
  const auto = !interactive && isGlobalInstall();

  if (!interactive && !auto) {
    // No TTY and not a global install — don't hang or surprise the install.
    log.dim(MANUAL_HINT);
    return;
  }

  try {
    // For a non-interactive global install force the user scope: there is no
    // project here, and a stray local `claude` in INIT_CWD must not steer the
    // detected default to project scope.
    const result = await installSlashCommands(auto ? { cwd, scope: 'user' } : { cwd });
    if (auto) {
      // Non-TTY global install: we cannot ask, so the status line stays opt-in —
      // we never silently edit the user's ~/.claude/settings.json. Be honest
      // about what we wrote and how to undo all of it again.
      log.hint(
        'Status line not enabled (opt-in). Turn it on later by adding a "statusLine" block to ~/.claude/settings.json.',
      );
      log.hint(
        `Remove everything: npm uninstall -g mini-orchestrator  (then delete ${result.target.displayDir})`,
      );
    }
  } catch (err) {
    // A failed postinstall must not break `npm install`.
    log.warn(`Could not install the slash commands automatically: ${(err as Error).message}`);
    log.hint(MANUAL_HINT);
  }

  // Status line: only in the interactive postinstall path, where a TTY is
  // present and the user is asked first. The non-TTY global path above leaves
  // ~/.claude/settings.json untouched on purpose — a failure here must likewise
  // not break the install or prevent the slash commands above.
  if (!auto) {
    try {
      await offerStatusline();
    } catch (err) {
      log.warn(`Could not set up the status line: ${(err as Error).message}`);
    }
  }
}
