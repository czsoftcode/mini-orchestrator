import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';
import { installSlashCommands, offerStatusline } from './install.js';

/** The command users can run by hand to (re)install the slash commands. */
export const MANUAL_HINT =
  'Install the /mini:* slash commands anytime with:  mini install-commands  (or: npx mini install-commands)';

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

  if (!isInteractive()) {
    // No TTY — don't hang the install. Just leave a breadcrumb.
    log.dim(MANUAL_HINT);
    return;
  }

  try {
    await installSlashCommands({ cwd });
  } catch (err) {
    // A failed postinstall must not break `npm install`.
    log.warn(`Could not install the slash commands automatically: ${(err as Error).message}`);
    log.hint(MANUAL_HINT);
  }

  // Offer the status line separately — a failure here must likewise not break
  // the install, and it should not prevent the slash commands above.
  try {
    await offerStatusline();
  } catch (err) {
    log.warn(`Could not set up the status line: ${(err as Error).message}`);
  }
}
