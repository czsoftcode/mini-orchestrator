import { workWithClaude } from '../claude/work.js';
import type { RangeInput } from '../range.js';
import { exists } from '../state/store.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { buildProjectAdversarialContext } from './adversarialProjectContext.js';
import type { StepOutcome } from './types.js';

// Like `mini adversarial`, this is an independent red-team review that **only
// reports** — but over a *range of phases* rather than the current one. Same
// guarantee: read + search tools and read-only git to see the diff, but **no
// `Edit`**, so the reviewer literally cannot touch a source file; findings are
// recorded by the one scoped write it can make, `mini findings add`. Kept as a
// separate constant from `adversarial.ts` (rather than shared) so each command's
// pinning test fails independently if its set drifts.
const ADVERSARIAL_PROJECT_ALLOWED_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'LS',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Bash(mini findings list:*)',
  'Bash(mini findings add:*)',
];

/**
 * `mini adversarial-project` — opens an interactive Claude Code session for an
 * independent red-team review of a **range of phases**, given by phase numbers
 * (`--from-phase`/`--to-phase`) or git refs (`--from`/`--to`). The terminal
 * counterpart of the `/mini:adversarial-project` slash command; the fresh Claude
 * session gives the reviewer independence from whoever wrote the code.
 *
 * The first message is built by {@link buildProjectAdversarialContext}, which
 * resolves the range and assembles the prompt. When that returns `null` (the
 * range couldn't be resolved — the builder already logged why), this exits
 * cleanly without starting a session.
 */
export async function adversarialProject(input: RangeInput): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const prompt = await buildProjectAdversarialContext(cwd, input);
  if (prompt === null) {
    // buildProjectAdversarialContext already logged the reason (range error).
    return { ok: false, reason: 'range-error' };
  }

  console.log();
  log.title('This is what I will send to Claude Code as the first message:');
  console.log();
  console.log(prompt);

  const { confirm } = await ask<'confirm'>({
    type: 'confirm',
    name: 'confirm',
    message: 'Start an adversarial (red-team review) session over this phase range?',
    initial: true,
  });

  if (!confirm) {
    log.dim('Cancelled. Nothing was changed.');
    return { ok: false, reason: 'cancelled' };
  }

  log.dim('Starting Claude Code (adversarial-project session)…');
  console.log();

  let exitCode: number;
  try {
    const result = await workWithClaude(prompt, {
      cwd,
      allowedTools: ADVERSARIAL_PROJECT_ALLOWED_TOOLS,
    });
    exitCode = result.exitCode;
  } catch (err) {
    log.error(`Failed to start Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Adversarial-project session finished.');
  } else {
    log.warn(`Claude session ended with code ${exitCode}.`);
  }

  log.hint('Next: review the recorded findings with mini findings list.');
  return { ok: true };
}
