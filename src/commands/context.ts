import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAutoPhasePrompt } from '../prompts/autoPhase.js';
import { buildDiscussPhasePrompt } from '../prompts/discussPhase.js';
import {
  buildDoneSessionPrompt,
  buildNextSessionPrompt,
  buildPlanSessionPrompt,
} from '../prompts/sessionContext.js';
import { LAST_MEMORY_FILE } from '../prompts/writeMemory.js';
import { readDiscussNotes } from '../state/discussNotes.js';
import {
  RunReportParseError,
  parseRunReport,
  runReportExists,
  runReportPath,
} from '../state/runReport.js';
import { exists, loadHeader, loadPhase, readProject } from '../state/store.js';
import type { Phase, ProjectState, StateHeader } from '../state/types.js';
import { log } from '../ui/log.js';

/** Pod-příkazy, pro které `mini context` umí vypsat session prompt. */
export const CONTEXT_COMMANDS = ['next', 'discuss', 'plan', 'do', 'done'] as const;
export type ContextCommand = (typeof CONTEXT_COMMANDS)[number];

export function isContextCommand(value: string): value is ContextCommand {
  return (CONTEXT_COMMANDS as readonly string[]).includes(value);
}

/**
 * `mini context <cmd>` — vypíše na stdout aktuální session prompt pro daný krok
 * workflow. Slouží nativním `/mini:` slash commandům v Claude Code: jejich tenké
 * tělo jen pustí `mini context <cmd>` a Claude se řídí vypsaným promptem. Prompt
 * se tak generuje vždy z aktuálního stavu mini, ne ze zmraženého textu v .md.
 *
 * Na stdout jde **jen prompt** (přes `process.stdout.write`), aby ho šlo bez
 * špíny předat dál. Chyby a nápovědy jdou přes `log` (stderr/stdout dle typu) a
 * nastaví nenulový exit code.
 */
export async function context(cmd: string, extraArgs: string[] = []): Promise<void> {
  const cwd = process.cwd();

  if (!isContextCommand(cmd)) {
    log.error(`Neznámý context pod-příkaz: "${cmd}".`);
    log.hint(`Použij jeden z: ${CONTEXT_COMMANDS.join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  if (!(await exists(cwd))) {
    log.error('V tomto adresáři není projekt (.mini/state.json).');
    log.hint('Začni: mini init');
    process.exitCode = 1;
    return;
  }

  // Granulární čtení (hot path slash commandů): hlavička je malá a `next` z ní
  // potřebuje jen index fází; ostatní kroky si k tomu načtou jen aktuální fázi.
  const [projectMd, header] = await Promise.all([readProject(cwd), loadHeader(cwd)]);

  let prompt: string | null;
  if (cmd === 'next') {
    prompt = await buildNextContext(projectMd, header, cwd, extraArgs);
  } else {
    prompt = await buildPhaseContext(cmd, projectMd, header, cwd);
  }

  if (prompt === null) {
    process.exitCode = 1;
    return;
  }

  process.stdout.write(prompt.endsWith('\n') ? prompt : `${prompt}\n`);
}

/** Sestaví lehký `ProjectState` z hlavičky — `next` z něj bere jen index fází. */
function stateFromHeader(header: StateHeader): ProjectState {
  const state: ProjectState = {
    version: header.version,
    createdAt: header.createdAt,
    currentPhaseId: header.currentPhaseId,
    phases: header.phases as Phase[],
  };
  if (header.models != null) state.models = header.models;
  return state;
}

async function buildNextContext(
  projectMd: string,
  header: StateHeader,
  cwd: string,
  extraArgs: string[],
): Promise<string> {
  const userHint = extraArgs.join(' ').trim() || undefined;
  const lastMemoryMd = await readLastMemoryIfExists(cwd);
  return buildNextSessionPrompt(projectMd, stateFromHeader(header), { userHint, lastMemoryMd });
}

/** Společný díl pro discuss/plan/do/done: vyžadují existující aktuální fázi. */
async function buildPhaseContext(
  cmd: Exclude<ContextCommand, 'next'>,
  projectMd: string,
  header: StateHeader,
  cwd: string,
): Promise<string | null> {
  if (header.currentPhaseId === null) {
    log.error('Žádná aktuální fáze.');
    log.hint('Spusť: /mini:next (nebo mini next)');
    return null;
  }
  const phase = await loadPhase(cwd, header.currentPhaseId);
  if (!phase) {
    log.error('Stav je nekonzistentní (currentPhaseId odkazuje na neexistující fázi).');
    return null;
  }

  if (cmd === 'discuss') {
    return buildDiscussPhasePrompt(projectMd, phase);
  }
  if (cmd === 'plan') {
    const discussNotes = await readDiscussNotes(cwd, phase.id);
    return buildPlanSessionPrompt(projectMd, phase, discussNotes);
  }
  if (cmd === 'do') {
    // `/mini:do` běží ve stejné chat session jako `/mini:plan` (nebo `auto`),
    // který diskuzní poznámky skoro vždy už načetl — Claude je má v kontextu.
    // Místo opakovaného inlinování předáme jen příznak reference módu (odkaz +
    // read-once), a to pouze když poznámky existují (jinak builder blok vynechá).
    const discussNotes = await readDiscussNotes(cwd, phase.id);
    const useDiscussNotesRef = discussNotes != null && discussNotes.trim() !== '';
    // Projekt řešíme stejně: `/mini:do` běží ve stejné session jako `/mini:plan`,
    // který projekt už inlinoval. Projekt je v session neměnný, takže ho stačí
    // odkázat (read-once) — `useProjectRef` zapínáme vždy (project.md tu existuje).
    return buildAutoPhasePrompt({
      projectMd,
      phase,
      useDiscussNotesRef,
      useProjectRef: true,
      retry: null,
    });
  }
  // done
  return buildDoneContext(phase, cwd);
}

async function buildDoneContext(phase: Phase, cwd: string): Promise<string> {
  const reportExists = await runReportExists(cwd, phase.id);
  if (!reportExists) {
    return buildDoneSessionPrompt({ phase, reportExists: false, verify: [] });
  }

  // Report čteme tolerantně — i kdyby nešel přísně naparsovat, chceme dát
  // Claudovi aspoň základní instrukce (poškozený report řeší až `--apply`).
  let verify: { title: string; detail?: string }[] = [];
  let body: string | undefined;
  try {
    const raw = await readFile(runReportPath(cwd, phase.id), 'utf-8');
    const report = parseRunReport(raw, {
      expectedPhaseId: phase.id,
      expectedStepTitles: (phase.steps ?? []).map((s) => s.title),
    });
    verify = report.verify;
    body = report.body;
  } catch (err) {
    if (!(err instanceof RunReportParseError)) {
      throw err;
    }
    // Poškozený report — necháme verify prázdné, Claude to probere bez detailů.
  }

  return buildDoneSessionPrompt({ phase, reportExists: true, reportBody: body, verify });
}

async function readLastMemoryIfExists(cwd: string): Promise<string | undefined> {
  try {
    return await readFile(join(cwd, LAST_MEMORY_FILE), 'utf-8');
  } catch {
    return undefined;
  }
}
