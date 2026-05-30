export type StepStatus = 'todo' | 'doing' | 'done' | 'skipped';

export type PhaseStatus = 'proposed' | 'planned' | 'doing' | 'done' | 'skipped';

export interface Step {
  title: string;
  status: StepStatus;
  /**
   * Plánovací detail kroku — kritéria / „Ověřitelné …", jak ho zapíše `plan`.
   * Drží `title` krátký (kanonický identifikátor pro párování reportu ↔ stav),
   * zatímco delší kontext pro implementátora žije tady. Liší se od `notes`:
   * `detail` je záměr z plánu (plně statický), `notes` je runtime poznámka
   * (např. detail blokeru z ručního ověření, viz `done` → opravná podfáze).
   */
  detail?: string;
  notes?: string;
}

/**
 * Záznam o auto-commitu, který `mini done` vytvořil po finalizaci fáze.
 *
 * Slouží `mini undo` k bezpečnému soft resetu: ověříme, že HEAD pořád sedí
 * na `sha` a pracovní strom je čistý, a teprve pak nabídneme revert. Subject
 * je tu pro lidsky čitelnou nabídku v UI.
 */
export interface PhaseAutoCommit {
  /** SHA HEAD před auto-commitem — cíl soft resetu. */
  preSha: string;
  /** SHA auto-commitu samotného. */
  sha: string;
  /** Subject (první řádek) commit message. */
  subject: string;
}

export interface Phase {
  id: number;
  title: string;
  goal?: string;
  status: PhaseStatus;
  steps?: Step[];
  humanNotes?: string;
  startedAt?: string;
  completedAt?: string;
  autoCommit?: PhaseAutoCommit;
  /**
   * Doslovné názvy bodů k ručnímu ověření (`verify` z reportu), které člověk
   * při verifikaci už vyřešil jako `pass`/`skip`. Slouží k tomu, aby opakovaný
   * `mini done` nad neměnícím se reportem znovu nenabízel už odbavené body —
   * `handleVerify` je při dalším průchodu přeskočí.
   */
  resolvedVerify?: string[];
}

export interface ProjectModels {
  default?: string;
  next?: string;
  plan?: string;
  do?: string;
  importGsd?: string;
  audit?: string;
  memory?: string;
}

export interface ProjectState {
  version: 2;
  createdAt: string;
  currentPhaseId: number | null;
  phases: Phase[];
  /** @deprecated use `models.default` */
  model?: string;
  models?: ProjectModels;
}

/**
 * Lehký souhrn fáze do indexu v hlavičce (`state.json`). Drží jen to, co
 * potřebují `mini status` a `mini context next` (přehled všech fází), aby
 * nemusely otevírat detail každé fáze. Plný detail (`goal`, `steps`, …) žije
 * v `.mini/phases/phase-<id>.json`.
 */
export type PhaseSummary = Pick<Phase, 'id' | 'title' | 'status'>;

/**
 * Hlavička stavu — obsah `state.json` v layoutu verze 2. Detail jednotlivých
 * fází je vyčleněn do souborů `.mini/phases/phase-<id>.json`; tady zůstává jen
 * lehký index (`phases`) a metadata projektu. Pořadí fází (vč. vsunutých
 * sub-fází) je dané pořadím v `phases`.
 */
export interface StateHeader {
  version: 2;
  createdAt: string;
  currentPhaseId: number | null;
  phases: PhaseSummary[];
  /** @deprecated use `models.default` */
  model?: string;
  models?: ProjectModels;
}
