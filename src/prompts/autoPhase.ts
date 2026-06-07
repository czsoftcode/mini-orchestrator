import { phaseStem } from '../state/store.js';
import { PARALLELISM_HINT } from './parallelismHint.js';
import { projectRefBlock } from './projectRef.js';
import type { Phase, StepStatus } from '../state/types.js';

const STEP_WORD: Record<StepStatus, string> = {
  done: 'done',
  doing: 'in progress',
  todo: 'todo',
  skipped: 'skipped',
};

export interface AutoPhaseRetryContext {
  /** Pořadové číslo průchodu (od 2 výš — první průchod retry nemá). */
  iteration: number;
  /**
   * Cesta k předchozímu reportu, kterou má Claude přečíst pro kontext.
   * Renderuje se rovnou do promptu, takže to musí být něco, co Claude umí
   * otevřít (typicky relativní cesta od cwd, např. `.mini/run/phase-009.prev.md`).
   */
  previousReportPath: string;
}

export interface AutoPhaseContext {
  projectMd: string;
  phase: Phase;
  discussNotes?: string | null;
  /**
   * Reference mód poznámek z diskuse (opt-in, default vypnuto). Když `true`,
   * místo inlinování `discussNotes` se vykreslí jen **odkaz** na soubor
   * `.mini/discuss/phase-{id}.md` + instrukce „přečti, jen pokud jsi je v této
   * session ještě nečetl". Použít pro interaktivní `/mini:do`, kde poznámky
   * skoro vždy už načetl `/mini:plan`/`auto` ve stejné chat session — opakovaný
   * inline by je do kontextu přilepil podruhé. Volající (context.ts) zapíná
   * příznak jen když poznámky existují, takže v reference módu se blok vykreslí
   * vždy. Headless `mini do` i `auto` zůstávají na inline (příznak vypnutý).
   */
  useDiscussNotesRef?: boolean;
  /**
   * Reference mód bloku projektu (opt-in, default vypnuto). Když `true`, místo
   * inlinování `projectMd` se pod nadpisem `# Projekt` vykreslí jen **odkaz** na
   * soubor `.mini/project.md` + instrukce „přečti, jen pokud jsi ho v této
   * session ještě nečetl". Stejná logika jako `useDiscussNotesRef`: pro
   * interaktivní `/mini:do`, kde projekt skoro vždy už načetl `/mini:plan`/`auto`
   * ve stejné chat session — opakovaný inline by ho do kontextu přilepil podruhé.
   * Headless `mini do` (jiný builder) i `auto` zůstávají na inline (vypnuto).
   */
  useProjectRef?: boolean;
  retry?: AutoPhaseRetryContext | null;
}

/**
 * Sestaví prompt pro auto-mód: jeden Claude session na celou fázi.
 *
 * Klíčový rozdíl proti `buildDoPhasePrompt`:
 * - žádný `focusedStep` — Claude má v jednom průchodu odpracovat celou fázi,
 * - Claude má na konci zapsat strukturovaný report do `.mini/run/phase-{id}.md`,
 *   ze kterého pak `done({ auto: true })` vyčte statusy kroků.
 */
export function buildAutoPhasePrompt(ctx: AutoPhaseContext): string {
  const { projectMd, phase, discussNotes, useDiscussNotesRef, useProjectRef, retry } = ctx;

  const reportPath = `.mini/run/${phaseStem(phase.id)}.md`;

  // Projekt: buď inline (default), nebo jen odkaz s read-once podmínkou
  // (reference mód). Reference šetří opakované načtení projektu ve stejné chat
  // session — projekt je v rámci session neměnný, takže „už ho máš, nenačítej".
  let projectBlock: string;
  if (useProjectRef) {
    projectBlock = projectRefBlock();
  } else {
    projectBlock = projectMd.trim();
  }

  let stepsBlock: string;
  if (phase.steps?.length) {
    const lines = phase.steps.map((s) => {
      const head = `- [${STEP_WORD[s.status]}] ${s.title}`;
      return s.detail ? `${head}\n    ${s.detail}` : head;
    });
    stepsBlock = `\nSteps (a guide for the work — do not edit them in any file, they only serve as the plan and reference names for the report):\n${lines.join('\n')}\n`;
  } else {
    stepsBlock = '\n(The phase is not broken down into steps — work on the whole phase at once.)\n';
  }

  // Poznámky z diskuse: buď inline (default), nebo jen odkaz s read-once
  // podmínkou (reference mód). Reference šetří opakované načtení ve stejné chat
  // session — volající zapíná příznak jen když poznámky existují.
  let notesBlock: string;
  if (useDiscussNotesRef) {
    const notesPath = `.mini/discuss/${phaseStem(phase.id)}.md`;
    notesBlock = `\n# Phase notes (from discussion)\nThe discussion notes for this phase are in \`${notesPath}\`. If you already read them in this session (typically during \`/mini:plan\` or at the start of \`auto\`), **do not read them again** — you have them in context. Otherwise read them now via the Read tool.\n`;
  } else {
    const notes = discussNotes?.trim();
    notesBlock = notes ? `\n# Phase notes (from discussion)\n${notes}\n` : '';
  }

  // Průběžný zápis: po každém dokončeném kroku ať Claude označí krok hotový
  // rovnou ve stavu. Když session spadne, zůstane stopa, kam až se došlo —
  // finální report jinak vzniká až úplně na konci. Dává smysl jen u fází
  // rozmenených na kroky.
  const progressBlock = phase.steps?.length
    ? `\n# Tracking step progress
As soon as you finish one step, mark it done **immediately** (before you start the next one):

\`\`\`
mini do --apply --step-done "<exact step name from the Steps section>"
\`\`\`

Copy the name character by character from the "Steps" section above. If the session crashes, the state will then show how far you got. Write the final report at the end (see below) regardless — tracking progress does not replace it.
`
    : '';

  const retryBlock = retry
    ? `\n# Retry (iteration ${retry.iteration})
In one of the previous iterations not all steps were finished. What is already done (or skipped) you'll see in the "Steps" section below — focus on the remaining ones. You'll find the previous report in \`${retry.previousReportPath}\` — read it so you know where the previous attempt ended and what it ran into. The new report (see below) overwrites the previous one.
`
    : '';

  // Vzorová YAML sekce kroků pro report. Klonujeme aktuální tituly, aby Claude
  // viděl přesný formát i správné názvy k překopírování. Statusy ve vzorku
  // jsou jen placeholder — Claude je má nahradit podle reálného výsledku.
  let sampleSteps: string;
  if (phase.steps?.length) {
    sampleSteps = phase.steps
      .map((s) => `  - title: "${escapeYamlDouble(s.title)}"\n    status: done`)
      .join('\n');
  } else {
    sampleSteps = '  []  # the phase has no steps — leave an empty list';
  }

  return `You are part of a tool that helps the user build a project incrementally.
An **auto session** is in progress — you are to implement the whole phase in one pass.

# Project
${projectBlock}
${retryBlock}
# Current phase
**Phase ${phase.id}: ${phase.title}**
Goal: ${phase.goal ?? '(not set)'}
${stepsBlock}${notesBlock}
# Your task
Implement all remaining steps so that the phase meets its goal. The steps above are a guide for the work — the order and granularity are up to you, and do not edit the files in \`.mini/state.json\` by hand. The user takes care of moving the phase status and the final step statuses via \`mini done\`, based on the report you write (see below).

Read the files yourself as needed. You work in acceptEdits mode, so you can edit without asking.

If you hit a **real** decision along the way — a concrete alternative weighed and **rejected**, not obvious from the code later — at the end tell the user to run \`/mini:decision\` (before \`/mini:done\`) to record the *why*. Don't write the ADR yourself; most phases have no such crossroads.

${PARALLELISM_HINT}
${progressBlock}

# Report at the end of the session
Before you end the session, **write via the Write tool** a report into the file \`${reportPath}\`. The report has two parts:

1) **YAML front matter** with machine-readable statuses. This part is parsed, so the structure must be exact. Rules:
   - the step names in \`steps[].title\` MUST match the names in the "Steps" section above verbatim (copy them character by character),
   - each step's status is exactly one of: \`done\`, \`skipped\` (deliberately omitted — explain in the text), \`blocked\` (you ran into a blocker — describe it in the text), \`todo\` (still to be done, e.g. ran out of time),
   - \`verdict\` summarizes the whole phase and is one of: \`done\` (everything finished), \`partial\` (something remains, but nothing stops you from continuing), \`blocked\` (you ran into a blocker you can't get around yourself),
   - optional field \`verify\` — a list of things you **could not verify yourself** and that need a human eye (visual UI, UX flow, subjective impression). Whatever can be verified mechanically (curl, tests, build), **verify it yourself** and don't put it in \`verify\`. Each item has \`title\` (what the human should verify, required) and optionally \`detail\` (context — what you did/didn't verify and how). When there is nothing for a human to verify, omit the field.

2) **Free text** below the YAML block — a short summary for the human: what went well, what didn't, what you ran into, open questions. This is where context that wouldn't fit into the YAML status belongs.

The file must start with a YAML block in exactly this form (adjust the statuses and add notes; do not change the step names or \`phase\`; add \`verify\` only when there is something for a human to verify, otherwise omit it):

\`\`\`
---
phase: ${phase.id}
verdict: done
steps:
${sampleSteps}
verify:   # optional — omit it when Claude verified everything itself
  - title: "what the human should verify (a visual/UX thing that can't be done mechanically)"
    detail: "what you did/didn't verify and how"
---

# Phase ${phase.id} — report from the auto session

(free text — what went well, what didn't, notes for the human)
\`\`\`

Only **after writing the report** end the session (type /exit or press Ctrl+D). Without a report the user has nothing to move the state from — they then go through it manually via the interactive \`mini done\`.
`;
}

function escapeYamlDouble(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
