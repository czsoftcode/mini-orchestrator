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
 * The run report is optional here (soft fallback, unlike `done`). We resolve it
 * to a three-state status, because *where the findings go* depends on it:
 * - `valid` — a parseable report exists: append the findings as a section, pass
 *   its free text in as context for the reviewer;
 * - `corrupt` — a report file exists but its YAML header is unparseable;
 * - `missing` — no report file at all.
 * For `corrupt`/`missing` the prompt must NOT have the reviewer write findings
 * into that file: `parseRunReport` would keep rejecting it and the findings would
 * be silently dropped from every later `done`/`verify`. We use the tolerant
 * `readRunReportSummary` (null = missing, `unparseable` = corrupt) so the
 * structural check doesn't depend on the steps matching the current state.
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
  const summary = await readRunReportSummary(cwd, phase.id);
  let reportStatus: 'valid' | 'corrupt' | 'missing';
  let reportBody: string | undefined;
  if (summary === null) {
    reportStatus = 'missing';
  } else if (summary.unparseable) {
    reportStatus = 'corrupt';
  } else {
    reportStatus = 'valid';
    reportBody = summary.body;
  }

  return buildAdversarialSessionPrompt({ phase, phaseDone, reportBody, reportStatus });
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
