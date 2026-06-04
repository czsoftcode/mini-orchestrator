import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { phaseStem } from './store.js';

/**
 * Directory for lightweight decision records (ADRs) tied to phases.
 *
 * Any phase where a non-trivial decision was made ("why this way and not
 * another") may carry a single markdown `phase-{id}.md` with a minimal
 * structure (heading + `Decision` + `Why`). This is deliberately not a
 * documentation system à la DocFlow:
 *
 * - **single source of truth = the file's existence.** No flag in `state.json`
 *   or `phase-{id}.json`, so there is nothing to keep in sync (and `undo` just
 *   removes/restores the file),
 * - **at most one decision per phase** — multiple reasons go as sections into
 *   the same file, not as a second file,
 * - **no independent `NNNN-` numbering** — the file is bound to the phase id via
 *   the shared `phaseStem`, exactly like `.mini/run/` and `.mini/memory/`.
 *
 * Writing (collection via `/mini:done`), the marker in the `mini status`
 * overview, the doctor orphan-check and `undo` are follow-up phases — this one
 * only reads and surfaces the record.
 */
export const DECISIONS_DIR = join('.mini', 'decisions');

/** Path to a phase's ADR file (`.mini/decisions/phase-{id}.md`). */
export function decisionPath(cwd: string, phaseId: number): string {
  return join(cwd, DECISIONS_DIR, `${phaseStem(phaseId)}.md`);
}

/** Does an ADR file exist for the given phase? */
export async function decisionExists(cwd: string, phaseId: number): Promise<boolean> {
  try {
    await access(decisionPath(cwd, phaseId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a phase's ADR and returns the raw markdown, or `null` when the file does
 * not exist (or is empty / whitespace only — treated as "no decision").
 *
 * The raw text is deliberately not parsed into `Decision`/`Why` sections — the
 * structure is a convention for the writer, not a contract for the reader. The
 * display (`status --phase`) just renders the text, much like a run report body.
 */
export async function readDecision(cwd: string, phaseId: number): Promise<string | null> {
  let raw: string;
  try {
    raw = await readFile(decisionPath(cwd, phaseId), 'utf8');
  } catch {
    return null;
  }
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  return text.length > 0 ? text : null;
}
