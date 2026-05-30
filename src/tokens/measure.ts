/**
 * Měření token ceny promptů jednotlivých mini příkazů.
 *
 * Cíl: relativní žebříček „který příkaz posílá Claudovi nejvíc" + rozpad, co
 * cenu žene. Tokeny se neměří přesným tokenizérem (ten má Claude jiný), ale
 * offline heuristikou (délka / 4) — pro porovnání mezi příkazy to stačí.
 *
 * Pro každý příkaz se sestaví reálný prompt (`realTokens`) a změří se obsahové
 * bloky, které do něj vkládáme (projekt, historie fází, last-memory, diskuzní
 * poznámky, run report, kroky, …). Součet bloků = `injectedTokens` (cena
 * vkládaného kontextu); zbytek `templateTokens` = cena fixní šablony promptu.
 *
 * Proč součet bloků a ne `reálný − minimální (prázdný build)`: některé šablony
 * mají větve (např. `done` přepíná podle přítomnosti `verify`), takže rozdíl
 * dvou různě větvených promptů cenu kontextu zkresluje. Měřit přímo vkládaný
 * obsah je odolnější a procenta v rozpadu pak dávají 100 %.
 *
 * Logika je čistá (žádné IO) a typovaná, aby šla testovat ve vitestu nad fixními
 * vstupy. Reálné vstupy z disku skládá runner `scripts/measure-prompt-tokens.ts`.
 */

import { buildAutoPhasePrompt } from '../prompts/autoPhase.js';
import { buildDiscussPhasePrompt } from '../prompts/discussPhase.js';
import {
  buildDoneSessionPrompt,
  buildNextSessionPrompt,
  buildPlanSessionPrompt,
} from '../prompts/sessionContext.js';
import { buildWriteMemoryPrompt } from '../prompts/writeMemory.js';
import type { Phase, ProjectState, Step } from '../state/types.js';

/** Příkazy, jejichž prompty měříme — v kanonickém pořadí workflow. */
export const COMMAND_IDS = [
  'next',
  'discuss',
  'plan',
  'do',
  'auto',
  'done',
  'writeMemory',
] as const;
export type CommandId = (typeof COMMAND_IDS)[number];

/** Odhad počtu tokenů: hrubá heuristika délka/4 (bez závislostí). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Pojmenovaný kus vkládaného kontextu (raw text, ze kterého se počítají tokeny). */
export interface ContextBlock {
  name: string;
  text: string;
}

export interface BlockTokens {
  name: string;
  tokens: number;
}

export interface CommandMeasurement {
  command: CommandId;
  /** Tokeny celého promptu s reálnými vstupy. */
  realTokens: number;
  /** Cena fixní šablony = realTokens − injectedTokens (clamp ≥ 0). */
  templateTokens: number;
  /** Cena vkládaného kontextu = součet tokenů obsahových bloků. */
  injectedTokens: number;
  /** Rozpad vkládaného kontextu na bloky, sestupně podle tokenů (jen nenulové). */
  blocks: BlockTokens[];
}

/** Vstupy pro jeden příkaz: jak z nich sestavit prompt a které bloky nesou. */
interface CommandSpec<I> {
  id: CommandId;
  build(inputs: I): string;
  blocks(inputs: I): ContextBlock[];
}

function measureSpec<I>(spec: CommandSpec<I>, real: I): CommandMeasurement {
  const realTokens = estimateTokens(spec.build(real));
  const blocks = spec
    .blocks(real)
    .map((b) => ({ name: b.name, tokens: estimateTokens(b.text) }))
    .filter((b) => b.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name));
  const injectedTokens = blocks.reduce((s, b) => s + b.tokens, 0);
  return {
    command: spec.id,
    realTokens,
    templateTokens: Math.max(0, realTokens - injectedTokens),
    injectedTokens,
    blocks,
  };
}

// --- Sdílené pomůcky pro sestavení bloků ----------------------------------

/** Lehká fáze do historie pro `next` (stačí id/title/status). */
export interface PhaseLite {
  id: number;
  title: string;
  status: Phase['status'];
}

/** Text bloku „historie fází" — přibližně jako ho renderuje next prompt. */
function phaseHistoryText(phases: PhaseLite[]): string {
  return phases.map((p) => `- [${p.status}] ${p.id}. ${p.title}`).join('\n');
}

/** Text bloku „fáze (název + cíl)". */
function phaseHeadText(phase: Phase): string {
  return `${phase.title}\n${phase.goal ?? ''}`;
}

/** Text bloku „kroky". */
function stepsText(phase: Phase): string {
  if (!phase.steps?.length) return '';
  return phase.steps.map((s) => `- [${s.status}] ${s.title}`).join('\n');
}

// --- Specifikace jednotlivých příkazů -------------------------------------

interface NextInputs {
  projectMd: string;
  phases: PhaseLite[];
  lastMemoryMd: string;
}
const nextSpec: CommandSpec<NextInputs> = {
  id: 'next',
  build: (i) => {
    const state: ProjectState = {
      version: 2,
      createdAt: '',
      currentPhaseId: null,
      phases: i.phases as Phase[],
    };
    return buildNextSessionPrompt(i.projectMd, state, {
      lastMemoryMd: i.lastMemoryMd || undefined,
    });
  },
  blocks: (i) => [
    { name: 'projekt', text: i.projectMd },
    { name: 'historie fází', text: phaseHistoryText(i.phases) },
    { name: 'last-memory', text: i.lastMemoryMd },
  ],
};

interface DiscussInputs {
  projectMd: string;
  phase: Phase;
}
const discussSpec: CommandSpec<DiscussInputs> = {
  id: 'discuss',
  build: (i) => buildDiscussPhasePrompt(i.projectMd, i.phase),
  blocks: (i) => [
    { name: 'projekt', text: i.projectMd },
    { name: 'fáze (název + cíl)', text: phaseHeadText(i.phase) },
    { name: 'kroky', text: stepsText(i.phase) },
  ],
};

interface PlanInputs {
  projectMd: string;
  phase: Phase;
  discussNotes: string;
}
const planSpec: CommandSpec<PlanInputs> = {
  id: 'plan',
  build: (i) => buildPlanSessionPrompt(i.projectMd, i.phase, i.discussNotes || null),
  blocks: (i) => [
    { name: 'projekt', text: i.projectMd },
    { name: 'fáze (název + cíl)', text: phaseHeadText(i.phase) },
    { name: 'kroky', text: stepsText(i.phase) },
    { name: 'diskuzní poznámky', text: i.discussNotes },
  ],
};

interface DoInputs {
  projectMd: string;
  phase: Phase;
  focusedStep: Step | null;
  discussNotes: string;
}
const doSpec: CommandSpec<DoInputs> = {
  id: 'do',
  // `/mini:do` (slash) emituje auto-prompt v reference módu — diskuzní poznámky
  // se neinlinují, jen odkaz + read-once (Claude je má z plan/auto). Proto tu
  // není blok „diskuzní poznámky". Pozor: Read call, kterým si je Claude za běhu
  // načte (když je v session nemá), se do tohoto odhadu NEPOČÍTÁ — číslo tedy
  // podhodnocuje reálný náklad jednoho izolovaného `do`.
  build: (i) =>
    buildAutoPhasePrompt({
      projectMd: i.projectMd,
      phase: i.phase,
      useDiscussNotesRef: true,
    }),
  blocks: (i) => [
    { name: 'projekt', text: i.projectMd },
    { name: 'fáze (název + cíl)', text: phaseHeadText(i.phase) },
    { name: 'kroky', text: stepsText(i.phase) },
  ],
};

interface AutoInputs {
  projectMd: string;
  phase: Phase;
  discussNotes: string;
}
const autoSpec: CommandSpec<AutoInputs> = {
  id: 'auto',
  build: (i) =>
    buildAutoPhasePrompt({
      projectMd: i.projectMd,
      phase: i.phase,
      discussNotes: i.discussNotes || null,
      retry: null,
    }),
  blocks: (i) => [
    { name: 'projekt', text: i.projectMd },
    { name: 'fáze (název + cíl)', text: phaseHeadText(i.phase) },
    { name: 'kroky', text: stepsText(i.phase) },
    { name: 'diskuzní poznámky', text: i.discussNotes },
  ],
};

export interface VerifyItem {
  title: string;
  detail?: string;
}
interface DoneInputs {
  phase: Phase;
  reportBody: string;
  verify: VerifyItem[];
}
const doneSpec: CommandSpec<DoneInputs> = {
  id: 'done',
  build: (i) =>
    buildDoneSessionPrompt({
      phase: i.phase,
      reportExists: true,
      reportBody: i.reportBody,
      verify: i.verify,
    }),
  blocks: (i) => [
    { name: 'fáze (název + cíl)', text: phaseHeadText(i.phase) },
    { name: 'run report', text: i.reportBody },
    { name: 'body k ověření', text: i.verify.map((v) => `${v.title} ${v.detail ?? ''}`).join('\n') },
  ],
};

interface WriteMemoryInputs {
  projectMd: string;
  phase: Phase;
}
const writeMemorySpec: CommandSpec<WriteMemoryInputs> = {
  id: 'writeMemory',
  build: (i) =>
    buildWriteMemoryPrompt({
      projectMd: i.projectMd,
      phase: i.phase,
      memoryPath: '.mini/memory/phase.md',
      hasAutoCommit: true,
    }),
  blocks: (i) => [
    { name: 'projekt', text: i.projectMd },
    { name: 'fáze (název + cíl)', text: phaseHeadText(i.phase) },
    { name: 'kroky', text: stepsText(i.phase) },
    { name: 'poznámka uživatele', text: i.phase.humanNotes ?? '' },
  ],
};

// --- Veřejné API ----------------------------------------------------------

/** Reálné vstupy (z disku) pro všechny příkazy najednou. */
export interface RealInputs {
  projectMd: string;
  /** Historie fází pro `next`. */
  phases: PhaseLite[];
  /** Reprezentativní fáze pro discuss/plan/do/auto/done/writeMemory. */
  phase: Phase;
  lastMemoryMd: string;
  discussNotes: string;
  reportBody: string;
  verify: VerifyItem[];
  /** Krok, na který `do` cílí (typicky první nedokončený). */
  focusedStep: Step | null;
}

/** Změří všechny příkazy z jednoho balíku reálných vstupů. */
export function measureAll(input: RealInputs): CommandMeasurement[] {
  return [
    measureSpec(nextSpec, {
      projectMd: input.projectMd,
      phases: input.phases,
      lastMemoryMd: input.lastMemoryMd,
    }),
    measureSpec(discussSpec, { projectMd: input.projectMd, phase: input.phase }),
    measureSpec(planSpec, {
      projectMd: input.projectMd,
      phase: input.phase,
      discussNotes: input.discussNotes,
    }),
    measureSpec(doSpec, {
      projectMd: input.projectMd,
      phase: input.phase,
      focusedStep: input.focusedStep,
      discussNotes: input.discussNotes,
    }),
    measureSpec(autoSpec, {
      projectMd: input.projectMd,
      phase: input.phase,
      discussNotes: input.discussNotes,
    }),
    measureSpec(doneSpec, {
      phase: input.phase,
      reportBody: input.reportBody,
      verify: input.verify,
    }),
    measureSpec(writeMemorySpec, { projectMd: input.projectMd, phase: input.phase }),
  ];
}

/** Seřadí měření sestupně podle reálných tokenů (tiebreak podle názvu příkazu). */
export function rankMeasurements(measurements: CommandMeasurement[]): CommandMeasurement[] {
  return [...measurements].sort(
    (a, b) => b.realTokens - a.realTokens || a.command.localeCompare(b.command),
  );
}

// --- Render ---------------------------------------------------------------

/** Krátké zdůvodnění „proč": top bloky vkládaného kontextu s podílem v %. */
function whyLine(m: CommandMeasurement): string {
  if (m.injectedTokens <= 0 || m.blocks.length === 0) {
    return 'fixní šablona, žádný vkládaný kontext';
  }
  const parts = m.blocks
    .slice(0, 2)
    .map((b) => `${b.name} ${Math.round((b.tokens / m.injectedTokens) * 100)} %`);
  return `vkládaný kontext ${m.injectedTokens} tok: ${parts.join(', ')}`;
}

/**
 * Markdown report do `.mini/token-report.md`. Čistá funkce (bez časové značky),
 * aby šla snapshotovat — proměnnou patičku (datum) doplní runner.
 */
export function renderReportMarkdown(ranked: CommandMeasurement[]): string {
  const lines: string[] = [];
  lines.push('# Token report — cena promptů mini příkazů');
  lines.push('');
  lines.push('Heuristika: odhad tokenů = délka textu / 4 (offline, ne přesný tokenizér Claude).');
  lines.push('Reálný = celý prompt · Šablona = fixní text promptu · Vkládaný kontext = součet');
  lines.push('obsahových bloků (projekt, historie fází, poznámky, …).');
  lines.push('');
  lines.push('| Příkaz | Reálný | Šablona | Vkládaný kontext |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const m of ranked) {
    lines.push(`| ${m.command} | ${m.realTokens} | ${m.templateTokens} | ${m.injectedTokens} |`);
  }
  lines.push('');
  lines.push('## Proč (rozpad vkládaného kontextu)');
  lines.push('');
  for (const m of ranked) {
    lines.push(`- **${m.command}** — ${whyLine(m)}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Kompaktní výpis žebříčku do konzole (stdout). */
export function renderConsole(ranked: CommandMeasurement[]): string {
  const pad = Math.max(...ranked.map((m) => m.command.length), 7);
  const lines: string[] = [];
  lines.push('Token report (heuristika délka/4), seřazeno podle reálných tokenů:');
  for (const m of ranked) {
    const name = m.command.padEnd(pad);
    lines.push(
      `  ${name}  reálný=${m.realTokens}  šablona=${m.templateTokens}  kontext=${m.injectedTokens}  (${whyLine(m)})`,
    );
  }
  return lines.join('\n');
}
