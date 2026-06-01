import { workWithClaude } from '../claude/work.js';
import { exists } from '../state/store.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
import type { StepOutcome } from './types.js';
import { buildVerifyPrompt } from './verifyContext.js';

// Verify is a human-led UI/UX review. Claude reads the phase output and writes
// the findings into the run report (and, for an already closed phase, into the
// memory) — so it needs read + edit, plus the search tools to locate things.
const VERIFY_ALLOWED_TOOLS = ['Read', 'Edit', 'Grep', 'Glob', 'LS'];

/**
 * `mini verify` — opens an interactive Claude Code session for the in-depth
 * UI/UX review of the current phase (or, when none is current, the last closed
 * one), symmetric to `mini discuss`. The first message is the same prompt that
 * `mini context verify` prints for the `/mini:verify` slash command.
 */
export async function verify(): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('No project in this directory.');
    log.hint('Start with: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const prompt = await buildVerifyPrompt(cwd);
  if (prompt === null) {
    // buildVerifyContext already logged the reason (no phase to verify).
    return { ok: false, reason: 'no-phase-to-verify' };
  }

  console.log();
  log.title('This is what I will send to Claude Code as the first message:');
  console.log();
  console.log(prompt);

  const { confirm } = await ask<'confirm'>({
    type: 'confirm',
    name: 'confirm',
    message: 'Start a verify (UI/UX review) session with Claude Code?',
    initial: true,
  });

  if (!confirm) {
    log.dim('Cancelled. The phase status did not change.');
    return { ok: false, reason: 'cancelled' };
  }

  log.dim('Starting Claude Code (verify session)…');
  console.log();

  let exitCode: number;
  try {
    const result = await workWithClaude(prompt, {
      cwd,
      allowedTools: VERIFY_ALLOWED_TOOLS,
    });
    exitCode = result.exitCode;
  } catch (err) {
    log.error(`Failed to start Claude: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  console.log();
  if (exitCode === 0) {
    log.success('Verify session finished.');
  } else {
    log.warn(`Claude session ended with code ${exitCode}.`);
  }

  log.hint('Next: fix any findings, then mini done (close the phase).');
  return { ok: true };
}
