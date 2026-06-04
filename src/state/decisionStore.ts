import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
 * Lists the ids of all phases that carry an ADR — a **single** `readdir` of
 * `.mini/decisions/`, parsing each `phase-{id}.md` filename back to its numeric
 * id. The phase id is the inverse of `phaseStem` (`phase-007` → `7`,
 * `phase-1.5` → `1.5`); a subphase keeps its dotted id.
 *
 * This is the cheap source for the `mini status` marker: one directory read
 * instead of a `decisionExists` per phase. A missing directory (no decision ever
 * recorded) yields an empty set, never an error. Files that do not match the
 * `phase-<number>.md` shape are ignored.
 */
export async function listDecisionPhaseIds(cwd: string): Promise<Set<number>> {
  let names: string[];
  try {
    names = await readdir(join(cwd, DECISIONS_DIR));
  } catch {
    return new Set();
  }
  const ids = new Set<number>();
  for (const name of names) {
    const match = name.match(/^phase-(\d+(?:\.\d+)?)\.md$/);
    if (!match) continue;
    const id = Number(match[1]);
    if (Number.isFinite(id)) ids.add(id);
  }
  return ids;
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

/**
 * Does the text carry at least one top-level Markdown heading (`# \u2026`)? The ADR
 * convention is `# <title>` + `## Decision` + `## Why`, but only the top-level
 * heading is enforced \u2014 the rest stays a writer's convention, not a reader's
 * contract (see `readDecision`). A heading-only guard is enough to reject empty
 * or obviously malformed bodies without over-validating the structure.
 */
export function hasHeading(text: string): boolean {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .some((line) => /^# \S/.test(line.trimStart()));
}

/** Outcome of {@link writeDecision} \u2014 nothing is written unless `ok` is true. */
export type WriteDecisionResult =
  | { ok: true; path: string }
  | { ok: false; reason: 'empty' | 'no-heading' };

/**
 * Writes (or overwrites) a phase's ADR file from a raw markdown body.
 *
 * Guards, mirroring the discussion for phase 127:
 * - an empty / whitespace-only body writes **nothing** (`reason: 'empty'`) \u2014 the
 *   "no decision" state is the file's absence, never an empty file,
 * - a body without a top-level `# ` heading writes **nothing**
 *   (`reason: 'no-heading'`) \u2014 see {@link hasHeading}.
 *
 * On success the `.mini/decisions/` directory is created if needed and the file
 * is written/overwritten with a single trailing newline; the body is stored as
 * given (only trimmed), since the structure is a convention for the writer.
 */
export async function writeDecision(
  cwd: string,
  phaseId: number,
  body: string,
): Promise<WriteDecisionResult> {
  const text = body.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
  if (text.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (!hasHeading(text)) {
    return { ok: false, reason: 'no-heading' };
  }
  const path = decisionPath(cwd, phaseId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${text}\n`, 'utf8');
  return { ok: true, path };
}
