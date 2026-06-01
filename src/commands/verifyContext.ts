import { readFile } from 'node:fs/promises';
import { buildVerifySessionPrompt } from '../prompts/sessionContext.js';
import {
  RunReportParseError,
  parseRunReport,
  runReportExists,
  runReportPath,
} from '../state/runReport.js';
import { loadHeader, loadPhase } from '../state/store.js';
import type { Phase, StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';

/**
 * Tolerant read of the verify items and free text from the phase run report.
 * When the report can't be parsed strictly, returns empty verify (a broken
 * report is handled by `--apply`). Shared by `mini context done` and the verify
 * prompt builder below.
 */
export async function readReportVerify(
  phase: Phase,
  cwd: string,
): Promise<{ verify: { title: string; detail?: string }[]; body?: string }> {
  let verify: { title: string; detail?: string }[] = [];
  let body: string | undefined;
  try {
    const raw = await readFile(runReportPath(cwd, phase.id), 'utf-8');
    const report = parseRunReport(raw, {
      expectedPhaseId: phase.id,
      expectedStepTitles: (phase.steps ?? []).map((s) => s.title),
    });
    verify = report.verify;
    body = report.body;
  } catch (err) {
    if (!(err instanceof RunReportParseError)) {
      throw err;
    }
    // Broken report — we leave verify empty, Claude goes through it without details.
  }
  return { verify, body };
}

/**
 * Builds the **verify** session prompt. The target phase = the current one
 * (`currentPhaseId`), otherwise a fallback to the last closed (`done`) one —
 * verify is typically also run after `done`, when currentPhaseId is no longer
 * set. Without a report it only warns (verify items are drawn from it), but it
 * still leads the review based on the phase goal and steps.
 *
 * Returns the prompt, or `null` (and logs the reason) when there is no phase to
 * verify. Shared by `mini context verify` (prints to stdout) and `mini verify`
 * (opens an interactive session with it).
 */
export async function buildVerifyContext(header: StateHeader, cwd: string): Promise<string | null> {
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
    log.error('No phase to verify (neither a current nor a closed phase).');
    log.hint('First work on a phase: /mini:next and /mini:do');
    return null;
  }

  const phaseDone = phase.status === 'done';
  const reportExists = await runReportExists(cwd, phase.id);
  const { verify, body } = reportExists
    ? await readReportVerify(phase, cwd)
    : { verify: [], body: undefined };

  return buildVerifySessionPrompt({ phase, phaseDone, verify, reportBody: body, reportExists });
}

/**
 * Convenience wrapper that loads the state header itself and builds the verify
 * prompt — used by the top-level `mini verify` command, which doesn't have the
 * header at hand the way `mini context` does.
 */
export async function buildVerifyPrompt(cwd: string): Promise<string | null> {
  const header = await loadHeader(cwd);
  return buildVerifyContext(header, cwd);
}
