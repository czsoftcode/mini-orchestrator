import { emptyTreeSha, headSha, runGit } from './git.js';
import { firstPhaseId, loadPhase } from './state/store.js';

/**
 * Inputs for a range resolution. Either the phase pair
 * (`fromPhase`/`toPhase`) or the ref pair (`from`/`to`) is given — never both
 * (that is rejected as a hard error). Mirrors the `adversarial-project` CLI
 * flags `--from-phase/--to-phase` and `--from/--to`.
 */
export interface RangeInput {
  fromPhase?: number;
  toPhase?: number;
  from?: string;
  to?: string;
}

/**
 * Result of {@link resolveRange}. A discriminated union instead of a thrown
 * error, consistent with `git.ts` (the git wrapper never throws): the caller
 * decides whether to print `error` and exit. `fromSha`/`toSha` are full commit
 * SHAs suitable for `git diff <fromSha>..<toSha>`.
 */
export type RangeResult =
  | { ok: true; fromSha: string; toSha: string }
  | { ok: false; error: string };

/** A flag value counts as "given" only when it is a non-empty string. */
function present(v: string | undefined): v is string {
  return v != null && v.trim().length > 0;
}

/**
 * Resolves a review range into `{ fromSha, toSha }`. Two mutually exclusive
 * modes:
 *
 * - **Phase mode** (`fromPhase`/`toPhase`): `fromSha` is the stored
 *   `autoCommit.preSha` of phase N (HEAD just before that phase's commit);
 *   `toSha` is the `preSha` of phase M+1, or current HEAD when M is the last
 *   phase. So `fromSha..toSha` spans phases N..M inclusive — assuming no
 *   commits landed between the phases that mini didn't record. When N is the
 *   project's **first** phase and has no recorded `preSha` (nothing was ever
 *   committed before it), `fromSha` falls back to the git empty-tree object so
 *   the range diffs from project genesis instead of failing.
 * - **Ref mode** (`from`/`to`): plain git refs, each verified to point at a
 *   commit via `git rev-parse --verify`.
 *
 * Hard-fails (returns `{ ok: false }`) on: mixing phase and ref flags, a
 * missing or inverted bound, a phase that doesn't exist, a non-first phase with
 * no recorded `preSha`, an invalid ref, or an empty range (both bounds resolve
 * to the same commit). Never throws. (A first phase without `preSha` does not
 * fail — see the genesis fallback above.)
 */
export async function resolveRange(cwd: string, input: RangeInput): Promise<RangeResult> {
  const hasPhase = input.fromPhase != null || input.toPhase != null;
  const hasRef = present(input.from) || present(input.to);

  if (hasPhase && hasRef) {
    return {
      ok: false,
      error:
        'Cannot mix phase flags (--from-phase/--to-phase) with ref flags (--from/--to) in one run.',
    };
  }
  if (!hasPhase && !hasRef) {
    return {
      ok: false,
      error: 'No range given. Use --from-phase/--to-phase or --from/--to.',
    };
  }

  const resolved = hasPhase
    ? await resolvePhaseRange(cwd, input.fromPhase, input.toPhase)
    : await resolveRefRange(cwd, input.from, input.to);
  if (!resolved.ok) return resolved;

  if (resolved.fromSha === resolved.toSha) {
    return { ok: false, error: 'Empty range: from and to resolve to the same commit.' };
  }
  return resolved;
}

async function resolvePhaseRange(
  cwd: string,
  fromPhase: number | undefined,
  toPhase: number | undefined,
): Promise<RangeResult> {
  if (fromPhase == null || toPhase == null) {
    return { ok: false, error: 'Phase range needs both --from-phase and --to-phase.' };
  }
  if (fromPhase > toPhase) {
    return {
      ok: false,
      error: `Inverted phase range: --from-phase ${fromPhase} is after --to-phase ${toPhase}.`,
    };
  }

  const from = await loadPhase(cwd, fromPhase);
  if (from === null) {
    return { ok: false, error: `Phase ${fromPhase} not found.` };
  }
  let fromSha = from.autoCommit?.preSha;
  if (!fromSha) {
    // No recorded pre-commit SHA. If this is the project's very first phase,
    // there is genuinely nothing committed before it — diff from the empty tree
    // (project genesis) instead of failing. For any later phase a missing preSha
    // is a real gap we can't pin down, so keep the clear error.
    const firstId = await firstPhaseId(cwd);
    if (firstId !== null && fromPhase === firstId) {
      const empty = await emptyTreeSha(cwd);
      if (!empty) {
        return {
          ok: false,
          error: `Phase ${fromPhase} has no recorded pre-commit SHA and the git empty-tree id is unavailable; cannot resolve range start.`,
        };
      }
      fromSha = empty;
    } else {
      return {
        ok: false,
        error: `Phase ${fromPhase} has no recorded pre-commit SHA (autoCommit.preSha); cannot resolve range start.`,
      };
    }
  }

  // toSha = preSha of phase M+1 (= state right after phase M committed). When
  // M+1 doesn't exist, M is the last phase → use current HEAD.
  const next = await loadPhase(cwd, toPhase + 1);
  let toSha: string;
  if (next === null) {
    const head = await headSha(cwd);
    if (!head) {
      return { ok: false, error: 'Cannot resolve range end: repository has no HEAD commit.' };
    }
    toSha = head;
  } else {
    const nextPre = next.autoCommit?.preSha;
    if (!nextPre) {
      return {
        ok: false,
        error: `Phase ${toPhase + 1} has no recorded pre-commit SHA (autoCommit.preSha); cannot resolve range end.`,
      };
    }
    toSha = nextPre;
  }

  return { ok: true, fromSha, toSha };
}

async function resolveRefRange(
  cwd: string,
  from: string | undefined,
  to: string | undefined,
): Promise<RangeResult> {
  if (!present(from) || !present(to)) {
    return { ok: false, error: 'Ref range needs both --from and --to.' };
  }

  const fromSha = await verifyRef(cwd, from);
  if (fromSha === null) {
    return { ok: false, error: `Invalid git ref: ${from}` };
  }
  const toSha = await verifyRef(cwd, to);
  if (toSha === null) {
    return { ok: false, error: `Invalid git ref: ${to}` };
  }

  return { ok: true, fromSha, toSha };
}

/**
 * Resolves a git ref to a full commit SHA, or `null` when it doesn't name a
 * commit. `^{commit}` forces commit resolution (so a tree/blob ref fails);
 * `--verify --quiet` makes an unknown ref a clean `ok: false` rather than noise.
 */
async function verifyRef(cwd: string, ref: string): Promise<string | null> {
  const r = await runGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd);
  if (!r.ok) return null;
  const sha = r.stdout.trim();
  return sha.length > 0 ? sha : null;
}
