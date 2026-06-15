import { workWithClaude } from '../claude/work.js';
import type { RangeInput } from '../range.js';
import { exists } from '../state/store.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { buildSecurityContext } from './securityReviewContext.js';
import type { StepOutcome } from './types.js';

// The security review is a **report-only** pass, like `adversarial-project`, but
// it writes a durable Markdown report itself instead of filing findings. So the
// allowed set swaps `Bash(mini findings add:*)` for a `Write` scoped to the
// report directory: read + search tools, read-only git to see the diff, and a
// single write target. `Edit` is deliberately absent — the reviewer cannot touch
// a source file.
//
// Caveat on the `Write` scope: `workWithClaude` does NOT pass `--permission-mode`,
// so this list only *pre-approves* writes under `.mini/security/`. A write
// outside that path is not hard-blocked — Claude falls back to **asking the
// human**. That ask is the safety net: the reviewer reads an untrusted diff, and
// a prompt-injection steering a write elsewhere surfaces to the user rather than
// going through silently. Kept as its own constant (not shared with
// adversarial-project) so a drift in either set fails its own pinning test.
const SECURITY_ALLOWED_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'LS',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git show:*)',
  'Write(.mini/security/**)',
];

/**
 * `mini security` — opens an interactive Claude Code session for an independent
 * **security review**. With no range flags it reviews the last `done` phase;
 * `--from-phase/--to-phase` or `--from/--to` review a range. The terminal
 * counterpart of the future `/mini:security` slash command; a fresh Claude
 * session gives the reviewer independence from whoever wrote the code.
 *
 * {@link buildSecurityContext} picks the range + report path and assembles the
 * first message (or logs and returns `null` on a range/no-phase error), the same
 * resolve+build path the `mini context security` slash route uses. When it
 * returns `null` the reason was already logged, so this exits cleanly without a
 * session.
 */
export async function security(input: RangeInput): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const ctx = await buildSecurityContext(cwd, input);
  if (ctx === null) {
    // buildSecurityContext already logged the reason (range / no-phase error).
    return { ok: false, reason: 'range-error' };
  }
  const { prompt, outputPath } = ctx;

  console.log();
  log.title('This is what I will send to Claude Code as the first message:');
  console.log();
  console.log(prompt);

  const { confirm } = await ask<'confirm'>({
    type: 'confirm',
    name: 'confirm',
    message: 'Start a security review session over this range?',
    initial: true,
  });

  if (!confirm) {
    log.dim('Cancelled. Nothing was changed.');
    return { ok: false, reason: 'cancelled' };
  }

  log.dim('Starting Claude Code (security review session)…');
  console.log();

  let exitCode: number;
  try {
    const result = await workWithClaude(prompt, {
      cwd,
      allowedTools: SECURITY_ALLOWED_TOOLS,
    });
    exitCode = result.exitCode;
  } catch (err) {
    log.error(`Failed to start Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Security review session finished.');
  } else {
    log.warn(`Claude session ended with code ${exitCode}.`);
  }

  log.hint(`Next: read the report at ${outputPath}.`);
  return { ok: true };
}

export { SECURITY_ALLOWED_TOOLS };
