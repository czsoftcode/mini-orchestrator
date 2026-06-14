import {
  type AdversarialProjectPhase,
  buildProjectAdversarialSessionPrompt,
} from '../prompts/sessionContext.js';
import { type RangeInput, resolveRange } from '../range.js';
import { loadPhase, readProject } from '../state/store.js';
import { log } from '../ui/log.js';

/**
 * Resolves which phases a review range covers, as id+title only (NOT full
 * reports). Only **phase mode** (`fromPhase`/`toPhase`) maps cleanly to phases —
 * for **ref mode** (`from`/`to`) a git ref need not line up with a phase
 * boundary, so we deliberately return an empty list and let the prompt fall back
 * to the diff. Missing phase files (a gap in the range) are skipped, not an
 * error: this is a thin index for a human reviewer, not a state mutation.
 */
export async function resolveRangePhases(
  cwd: string,
  input: RangeInput,
): Promise<AdversarialProjectPhase[]> {
  if (input.fromPhase == null || input.toPhase == null) return [];

  const phases: AdversarialProjectPhase[] = [];
  for (let id = input.fromPhase; id <= input.toPhase; id++) {
    const phase = await loadPhase(cwd, id);
    if (phase) phases.push({ id: phase.id, title: phase.title });
  }
  return phases;
}

/**
 * Reads `.mini/project.md`, tolerating its absence: an adversarial-project review
 * is still useful without the vision block, so a missing/unreadable file
 * degrades to a short note rather than crashing the whole context.
 */
async function readProjectSafe(cwd: string): Promise<string> {
  try {
    return await readProject(cwd);
  } catch {
    return '(no .mini/project.md found — review against the diff only)';
  }
}

/**
 * Builds the **adversarial project** prompt for a range of phases. Resolves the
 * range via {@link resolveRange} (phase or ref mode); on any range error it logs
 * the reason and returns `null` (mirroring `buildAdversarialContext`), so the
 * caller just exits without a prompt. Otherwise it assembles a thin reviewer
 * index — project.md, the resolved bounds, the in-range phase list — and hands it
 * to {@link buildProjectAdversarialSessionPrompt}.
 *
 * No CLI dispatch or interactive session wiring lives here — those are separate
 * later phases. This is only the builder.
 */
export async function buildProjectAdversarialContext(
  cwd: string,
  input: RangeInput,
): Promise<string | null> {
  const range = await resolveRange(cwd, input);
  if (!range.ok) {
    log.error(range.error);
    log.hint('Specify a range with --from-phase/--to-phase or --from/--to.');
    return null;
  }

  const [phases, projectMd] = await Promise.all([
    resolveRangePhases(cwd, input),
    readProjectSafe(cwd),
  ]);

  return buildProjectAdversarialSessionPrompt({
    projectMd,
    fromSha: range.fromSha,
    toSha: range.toSha,
    phases,
  });
}
