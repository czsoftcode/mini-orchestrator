import { workWithClaude } from '../claude/work.js';
import { exists } from '../state/store.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { buildAdversarialPrompt } from './adversarialContext.js';
import type { StepOutcome } from './types.js';

// Adversarial is an independent red-team review that **only reports** — it must
// not modify the code it reviews. So it gets read + search tools and read-only
// git to see the actual diff, but **no `Edit`**: findings are recorded by calling
// `mini findings add`, which is the one write it can make (scoped Bash). With no
// `Edit` in the set the reviewer literally cannot touch a source file. (The
// `/mini:adversarial` slash path runs in the user's own session and can't be
// scoped this way — there, report-only rests on the prompt instruction alone.)
// Caveat: how strictly Claude Code enforces scoped `Bash(... :*)` patterns is not
// independently verified here; dropping `Edit` is the load-bearing guarantee.
const ADVERSARIAL_ALLOWED_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'LS',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(mini findings add:*)',
];

/**
 * `mini adversarial` — opens an interactive Claude Code session for an
 * independent red-team review of the current phase (or, when none is current,
 * the last closed one), symmetric to `mini verify`. The key difference from the
 * `/mini:adversarial` slash command: this spawns a **fresh** Claude session, so
 * the reviewer does not share the context (and blind spots) of whoever wrote the
 * code — the independence the step is about. The first message is the same prompt
 * that `mini context adversarial` prints for the slash command.
 */
export async function adversarial(): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const prompt = await buildAdversarialPrompt(cwd);
  if (prompt === null) {
    // buildAdversarialContext already logged the reason (no phase to review).
    return { ok: false, reason: 'no-phase-to-review' };
  }

  console.log();
  log.title('This is what I will send to Claude Code as the first message:');
  console.log();
  console.log(prompt);

  const { confirm } = await ask<'confirm'>({
    type: 'confirm',
    name: 'confirm',
    message: 'Start an adversarial (red-team review) session with Claude Code?',
    initial: true,
  });

  if (!confirm) {
    log.dim('Cancelled. The phase status did not change.');
    return { ok: false, reason: 'cancelled' };
  }

  log.dim('Starting Claude Code (adversarial session)…');
  console.log();

  let exitCode: number;
  try {
    const result = await workWithClaude(prompt, {
      cwd,
      allowedTools: ADVERSARIAL_ALLOWED_TOOLS,
    });
    exitCode = result.exitCode;
  } catch (err) {
    log.error(`Failed to start Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Adversarial session finished.');
  } else {
    log.warn(`Claude session ended with code ${exitCode}.`);
  }

  log.hint('Next: address any findings, then mini done (close the phase).');
  return { ok: true };
}
