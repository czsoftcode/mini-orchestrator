import { buildAdversarialSessionPrompt } from '../prompts/sessionContext.js';
import { readRunReportSummary } from '../state/runReport.js';
import { loadHeader, loadPhase } from '../state/store.js';
import type { Phase, StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';

/**
 * Builds the **adversarial** session prompt. The target phase = the current one
 * (`currentPhaseId`), otherwise a fallback to the last closed (`done`) one — the
 * red-team step is meant to run between `do` and `done`, but it stays useful as a
 * retrospective review of an already closed phase (same selection as `verify`).
 *
 * The run report is optional here (soft fallback, unlike `done`) and only serves
 * as **context** for the reviewer (what the phase did). Findings no longer go
 * into the report — they go to the `.mini/findings/` store via `mini findings
 * add` — so the report's parse status no longer decides where anything is
 * written. We just pass its free text along when it parses; a missing or corrupt
 * report leaves the reviewer to work from the `git diff`. The tolerant
 * `readRunReportSummary` (null = missing, `unparseable` = corrupt) lets us read
 * the body without the steps having to match the current state.
 *
 * Returns the prompt, or `null` (and logs the reason) when there is no phase to
 * review. Shared by `mini context adversarial` (prints to stdout) and
 * `mini adversarial` (opens an interactive session with it).
 */
export async function buildAdversarialContext(
  header: StateHeader,
  cwd: string,
): Promise<string | null> {
  let phase: Phase | null = null;
  if (header.currentPhaseId !== null) {
    phase = await loadPhase(cwd, header.currentPhaseId);
  } else {
    const lastDone = [...header.phases].reverse().find((p) => p.status === 'done');
    if (lastDone) {
      phase = await loadPhase(cwd, lastDone.id);
    }
  }

  if (!phase) {
    log.error('No phase to red-team (neither a current nor a closed phase).');
    log.hint('First work on a phase: /mini:next and /mini:do');
    return null;
  }

  const phaseDone = phase.status === 'done';
  // Optional context only: a parseable report contributes its free text; a
  // missing or corrupt one just leaves the reviewer to work from the git diff.
  const summary = await readRunReportSummary(cwd, phase.id);
  const reportBody = summary && !summary.unparseable ? summary.body : undefined;

  return buildAdversarialSessionPrompt({ phase, phaseDone, reportBody });
}

/**
 * Convenience wrapper that loads the state header itself and builds the
 * adversarial prompt — used by the top-level `mini adversarial` command, which
 * doesn't have the header at hand the way `mini context` does.
 */
export async function buildAdversarialPrompt(cwd: string): Promise<string | null> {
  const header = await loadHeader(cwd);
  return buildAdversarialContext(header, cwd);
}
