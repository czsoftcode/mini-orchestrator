import { askClaude } from '../claude/ask.js';
import { buildPlanPhasePrompt } from '../prompts/planPhase.js';
import { readDiscussNotes } from '../state/discussNotes.js';
import { resolveModel } from '../state/models.js';
import { exists, load, readProject, save } from '../state/store.js';
import type { Step } from '../state/types.js';
import { ask, trim } from '../ui/ask.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';
import type { AutoOptions, StepOutcome } from './types.js';

export async function plan(opts: AutoOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const [projectMd, state] = await Promise.all([readProject(cwd), load(cwd)]);

  if (state.currentPhaseId === null) {
    log.warn('Žádná aktuální fáze k rozplánování.');
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('Stav je nekonzistentní (currentPhaseId odkazuje na neexistující fázi).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done' || phase.status === 'skipped') {
    log.info(`Fáze ${phase.id} už není aktivní (${phase.status}).`);
    return { ok: false, reason: 'phase-not-active' };
  }

  if (phase.steps?.length) {
    if (opts.auto) {
      log.dim(`Fáze ${phase.id} už má ${phase.steps.length} kroků — v auto režimu přepisuji.`);
    } else {
      log.warn(`Fáze ${phase.id} už má ${phase.steps.length} kroků.`);
      const { ow } = await ask<'ow'>({
        type: 'confirm',
        name: 'ow',
        message: 'Přepsat je novým plánem?',
        initial: false,
      });
      if (!ow) {
        log.dim('Nic se nemění.');
        return { ok: false, reason: 'cancelled' };
      }
    }
  }

  const discussNotes = await readDiscussNotes(cwd, phase.id);
  const prompt = buildPlanPhasePrompt(projectMd, phase, discussNotes);
  log.dim('Přemýšlím nad krocí…');

  let response;
  try {
    response = await askClaude(prompt, { cwd, allowedTools: ['Read', 'Glob', 'Grep'], model: resolveModel('plan', state) });
  } catch (err) {
    log.error(`Claude se nepodařilo zeptat: ${(err as Error).message}`);
    return { ok: false, reason: 'claude-error' };
  }

  logUsage(response);

  let titles = parseSteps(response.text);
  if (titles.length === 0) {
    log.warn('Claude odpověděl ve formátu, který neumím přečíst:');
    console.log(response.text);
    return { ok: false, reason: 'parse-failed' };
  }

  if (!opts.auto) {
    console.log();
    log.title(`Navržené kroky (${titles.length}):`);
    titles.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t}`);
    });
    console.log();

    const { decision } = await ask<'decision'>({
      type: 'select',
      name: 'decision',
      message: 'Co s tím?',
      choices: [
        { title: 'Použít tak jak jsou', value: 'use' },
        { title: 'Upravit (po jednom kroku, prázdné = smazat)', value: 'edit' },
        { title: 'Zrušit', value: 'cancel' },
      ],
    });

    if (decision === 'cancel') {
      log.dim('Nic se nemění.');
      return { ok: false, reason: 'cancelled' };
    }

    if (decision === 'edit') {
      const edited: string[] = [];
      for (let i = 0; i < titles.length; i++) {
        const { title } = await ask<'title'>({
          type: 'text',
          name: 'title',
          message: `Krok ${i + 1}:`,
          initial: titles[i],
          format: trim,
        });
        if ((title as string).length > 0) {
          edited.push(title as string);
        }
      }
      if (edited.length === 0) {
        log.warn('Žádné kroky nezbyly. Nic se nemění.');
        return { ok: false, reason: 'cancelled' };
      }
      titles = edited;
    }
  }

  const steps: Step[] = titles.map((title) => ({ title, status: 'todo' }));
  phase.steps = steps;
  if (phase.status === 'proposed') {
    phase.status = 'planned';
  }
  await save(state, cwd);

  log.success(`Fáze ${phase.id} rozmenena na ${steps.length} ${steps.length === 1 ? 'krok' : 'kroků'}.`);
  if (!opts.auto) {
    log.hint('Další: mini do');
  }
  return { ok: true };
}

/**
 * Neinteraktivní uložení kroků aktuální fáze — pro `mini plan --apply` (volá ho
 * `/mini:plan`, když Claude v session rozmenil fázi). Žádný Claude: jen zapíše
 * předané kroky do stavu se stejnou logikou jako interaktivní `plan`.
 */
export async function applyPlanSteps(
  parsed: ParsedStep[],
  cwd: string = process.cwd(),
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const clean = parsed
    .map((p) => ({ title: p.title.trim(), detail: p.detail?.trim() }))
    .filter((p) => p.title.length > 0);
  if (clean.length === 0) {
    log.error('Nedostal jsem žádné kroky (stdin byl prázdný).');
    return { ok: false, reason: 'no-steps' };
  }

  const state = await load(cwd);

  if (state.currentPhaseId === null) {
    log.warn('Žádná aktuální fáze k rozplánování.');
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('Stav je nekonzistentní (currentPhaseId odkazuje na neexistující fázi).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done' || phase.status === 'skipped') {
    log.info(`Fáze ${phase.id} už není aktivní (${phase.status}).`);
    return { ok: false, reason: 'phase-not-active' };
  }

  const steps: Step[] = clean.map((p) => ({
    title: p.title,
    status: 'todo',
    ...(p.detail ? { detail: p.detail } : {}),
  }));
  phase.steps = steps;
  if (phase.status === 'proposed') {
    phase.status = 'planned';
  }
  await save(state, cwd);

  log.success(`Fáze ${phase.id} rozmenena na ${steps.length} ${steps.length === 1 ? 'krok' : 'kroků'}.`);
  return { ok: true };
}

/** Oddělovač `title :: detail` na jednom řádku stdin. Mezery kolem `::` ho
 * dělají odolným vůči samostatným dvojtečkám v textu titulu nebo detailu. */
const STEP_DETAIL_SEPARATOR = ' :: ';

/** Naparsovaný krok ze stdin: krátký `title` + volitelný plánovací `detail`. */
export interface ParsedStep {
  title: string;
  detail?: string;
}

/**
 * Naparsuje kroky předané na stdin pro `mini plan --apply`. Tolerantní k tomu,
 * jak je Claude zapíše: bere každý neprázdný řádek jako jeden krok a odstraní
 * běžné prefixy seznamu (`STEP:`, `- `, `* `, `1. `).
 *
 * Formát řádku: `title :: detail`. Oddělovač ` :: ` je volitelný — řádek bez
 * něj je jen `title` (zpětná kompatibilita se starým „jeden title na řádek").
 * Bere se první výskyt oddělovače; prázdný `detail` se vynechá.
 */
export function parseStepsFromStdin(text: string): ParsedStep[] {
  const out: ParsedStep[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (line.length === 0) continue;
    line = line.replace(/^STEP:\s*/i, '');
    line = line.replace(/^[-*]\s+/, '');
    line = line.replace(/^\d+[.)]\s+/, '');
    line = line.trim();
    if (line.length === 0) continue;

    // Visící oddělovač na konci řádku (`title ::`) = prázdný detail. `trim()`
    // výše odstranil koncovou mezeru, takže ho ` :: ` nezachytí — ošetříme zvlášť.
    if (line.endsWith(' ::')) {
      const title = line.slice(0, -' ::'.length).trim();
      if (title.length > 0) out.push({ title });
      continue;
    }

    const sep = line.indexOf(STEP_DETAIL_SEPARATOR);
    if (sep === -1) {
      out.push({ title: line });
      continue;
    }
    const title = line.slice(0, sep).trim();
    const detail = line.slice(sep + STEP_DETAIL_SEPARATOR.length).trim();
    if (title.length === 0) continue;
    out.push(detail.length > 0 ? { title, detail } : { title });
  }
  return out;
}

export function parseSteps(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^STEP:\s*(.+)$/);
    if (m?.[1]) {
      const t = m[1].trim();
      if (t.length > 0) {
        out.push(t);
      }
    }
  }
  return out;
}
