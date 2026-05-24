export type StepStatus = 'todo' | 'doing' | 'done' | 'skipped';

export type PhaseStatus = 'proposed' | 'planned' | 'doing' | 'done' | 'skipped';

export interface Step {
  title: string;
  status: StepStatus;
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
  version: 1;
  createdAt: string;
  currentPhaseId: number | null;
  phases: Phase[];
  /** @deprecated use `models.default` */
  model?: string;
  models?: ProjectModels;
}
