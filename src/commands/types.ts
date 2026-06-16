export type StepOutcome =
  | { ok: true; phaseAdvanced?: boolean; nextPhaseId?: number | null }
  | { ok: false; reason: string };

import type { BumpChoice } from '../version.js';

export interface AutoOptions {
  auto?: boolean;
  stream?: boolean;
  maxTurns?: number;
  /** Úroveň navýšení verze při finalizaci fáze (default `none` — nenavyšovat). */
  bump?: BumpChoice;
  /** Po commitu fáze pushnout na remote (opt-in). */
  push?: boolean;
}

/** Volby finalizačních side-effectů (commit fáze): bump verze + případný push. */
export interface FinalizeOptions {
  /** Úroveň navýšení verze (default `none` — nenavyšovat). */
  bump?: BumpChoice;
  push?: boolean;
  /**
   * Ids of open review findings to close at the `done` checkpoint *beyond* the
   * phase's linked `fromFinding` — from `mini done --apply --resolve-finding
   * <id>`. Each that this run actually flips open→resolved is recorded on
   * `phase.resolvedFindings` so `mini undo` reopens it. Missing/already-resolved
   * ids are tolerant no-ops and are not recorded.
   */
  resolveFindings?: string[];
}
