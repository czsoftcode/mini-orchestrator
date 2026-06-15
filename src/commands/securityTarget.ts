import { join } from 'node:path';

import { headSha } from '../git.js';
import { type RangeInput, resolveRange } from '../range.js';
import { loadHeader, loadPhase } from '../state/store.js';
import { log } from '../ui/log.js';

/** Length of the SHA prefix used when naming a ref-mode report file. */
const SHORT_SHA_LEN = 7;

export interface SecurityTarget {
  /**
   * The range to review. In the default case (no flags) this is the synthesised
   * single-phase range for the last `done` phase; otherwise it is the caller's
   * input unchanged.
   */
  input: RangeInput;
  /** Where the reviewer must write its report, e.g. `.mini/security/phase-12.md`. */
  outputPath: string;
}

/** A flag value counts as "given" only when it is a non-empty string. */
function present(v: string | undefined): v is string {
  return v != null && v.trim().length > 0;
}

/** Id of the latest phase marked `done`, or `null` when none is. */
async function lastDonePhaseId(cwd: string): Promise<number | null> {
  const header = await loadHeader(cwd);
  const lastDone = [...header.phases].reverse().find((p) => p.status === 'done');
  return lastDone ? lastDone.id : null;
}

/**
 * Resolves what `mini security` should review and where the report goes. Three
 * shapes of input, one output path scheme:
 *
 * - **No flags** → the last `done` phase, reviewed from its `preSha` to **HEAD**.
 *   Report: `.mini/security/phase-<id>.md`. The end is HEAD, *not* the next
 *   phase's `preSha` the way `resolveRange`'s phase mode would compute it: the
 *   last done phase's commit IS HEAD, and the usual next phase is the in-progress
 *   one with no `preSha` to anchor to (which would otherwise hard-fail every
 *   default run). A first phase without `preSha` falls back to phase mode so the
 *   genesis (empty-tree) start still works. Errors (logs + returns `null`) when
 *   there is no completed phase yet.
 * - **Phase flags** (`--from-phase/--to-phase`) → report
 *   `.mini/security/range-<A>-<B>.md`, named from the phase numbers the user
 *   gave (human-readable, stable).
 * - **Ref flags** (`--from/--to`) → refs aren't filename-safe, so the report is
 *   named from the resolved commit SHAs: `.mini/security/range-<short>-<short>.md`.
 *
 * Range validity (mixing phase+ref flags, a missing bound, an unknown ref, an
 * empty range, the genesis fallback for a first phase without `preSha`) is **not**
 * re-implemented here: every non-default case is run through {@link resolveRange},
 * the single source of truth, and its error is surfaced as-is. On success the
 * resolved SHAs double as the ref-mode filename, so the validation isn't wasted.
 * `buildSecurityReviewContext` resolves the range a second time — cheap, pure git
 * reads — which keeps that builder's phase-169 signature untouched.
 *
 * Returns `null` (after logging the reason) on any error, so the caller just
 * exits without starting a session.
 */
export async function resolveSecurityTarget(
  cwd: string,
  input: RangeInput,
): Promise<SecurityTarget | null> {
  const hasPhase = input.fromPhase != null || input.toPhase != null;
  const hasRef = present(input.from) || present(input.to);

  // Default: no flags → the last completed phase, from its preSha to HEAD.
  if (!hasPhase && !hasRef) {
    const id = await lastDonePhaseId(cwd);
    if (id === null) {
      log.error('No completed (done) phase to review yet.');
      log.hint('Finish a phase first, or pass a range with --from-phase/--to-phase or --from/--to.');
      return null;
    }
    const phase = await loadPhase(cwd, id);
    const preSha = phase?.autoCommit?.preSha;

    let derived: RangeInput;
    if (preSha) {
      // End at HEAD (the last done phase's own commit), not the next phase's
      // preSha — that next phase is typically the in-progress one with no preSha.
      const head = await headSha(cwd);
      if (head === null) {
        log.error('Cannot resolve range end: repository has no HEAD commit.');
        return null;
      }
      derived = { from: preSha, to: head };
    } else {
      // No preSha: only the project's very first phase legitimately has none.
      // Delegate to phase mode so resolveRange applies the genesis (empty-tree)
      // start, and surfaces its own clear error for a non-first phase.
      derived = { fromPhase: id, toPhase: id };
    }

    const range = await resolveRange(cwd, derived);
    if (!range.ok) {
      log.error(range.error);
      return null;
    }
    return { input: derived, outputPath: securityReportPath(`phase-${id}`) };
  }

  const range = await resolveRange(cwd, input);
  if (!range.ok) {
    log.error(range.error);
    log.hint('Specify a range with --from-phase/--to-phase or --from/--to.');
    return null;
  }

  const slug = hasPhase
    ? `range-${input.fromPhase}-${input.toPhase}`
    : `range-${range.fromSha.slice(0, SHORT_SHA_LEN)}-${range.toSha.slice(0, SHORT_SHA_LEN)}`;

  return { input, outputPath: securityReportPath(slug) };
}

/** `.mini/security/<slug>.md` — the home of every security report. */
function securityReportPath(slug: string): string {
  return join('.mini', 'security', `${slug}.md`);
}
