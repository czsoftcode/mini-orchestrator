import { buildSecurityReviewSessionPrompt } from '../prompts/sessionContext.js';
import { type RangeInput, resolveRange } from '../range.js';
import { readProject } from '../state/store.js';
import { log } from '../ui/log.js';
import { resolveRangePhases } from './adversarialProjectContext.js';

/**
 * Reads `.mini/project.md`, tolerating its absence: a security review is still
 * useful without the vision block, so a missing/unreadable file degrades to a
 * short note rather than crashing the whole context. Mirrors the
 * adversarial-project assembler's `readProjectSafe`.
 */
async function readProjectSafe(cwd: string): Promise<string> {
  try {
    return await readProject(cwd);
  } catch {
    return '(no .mini/project.md found — review against the diff only)';
  }
}

/**
 * Builds the **security review** prompt for a range of phases. Resolves the range
 * via {@link resolveRange} (phase or ref mode); on any range error it logs the
 * reason and returns `null` (mirroring `buildProjectAdversarialContext`), so the
 * caller just exits without a prompt. Otherwise it assembles a thin reviewer
 * index — project.md, the resolved bounds, the in-range phase list — and hands it
 * to {@link buildSecurityReviewSessionPrompt} together with the `outputPath` the
 * reviewer must write its report to.
 *
 * `outputPath` is a **parameter**, not derived here: computing where the report
 * lives (the `.mini/security/<range>.md` filename) belongs to the future CLI, so
 * this builder stays pure with respect to naming. It writes no file and does no
 * CLI dispatch — those are separate later phases. This is only the builder.
 */
export async function buildSecurityReviewContext(
  cwd: string,
  input: RangeInput,
  outputPath: string,
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

  return buildSecurityReviewSessionPrompt({
    projectMd,
    fromSha: range.fromSha,
    toSha: range.toSha,
    phases,
    outputPath,
  });
}
