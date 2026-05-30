import { commitAll, createTag, hasChanges, headSha, isGitRepo, push, pushTag } from '../git.js';
import { buildGraph, GRAPH_DIR, hasMappableProject } from '../graph/buildGraph.js';
import { bumpPackageVersion } from '../version.js';
import {
  RunReportParseError,
  readRunReport,
  runReportPath,
  type RunReport,
  type RunReportVerifyItem,
} from '../state/runReport.js';
import { exists, load, save } from '../state/store.js';
import type { Phase, ProjectState, Step } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { isInteractive } from '../ui/interactive.js';
import { log } from '../ui/log.js';
import type { AutoOptions, FinalizeOptions, StepOutcome } from './types.js';
import { writePhaseMemory } from './writeMemory.js';

export async function done(opts: AutoOptions = {}): Promise<StepOutcome> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const state = await load(cwd);

  if (state.currentPhaseId === null) {
    log.warn('Žádná aktuální fáze.');
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('Stav je nekonzistentní (currentPhaseId odkazuje na neexistující fázi).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done') {
    log.info(`Fáze ${phase.id} (${phase.title}) už je hotová.`);
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'phase-done' };
  }

  // V auto módu se stav fáze posouvá podle reportu, který Claude zapsal na
  // konci session. Když report sedí, posuneme statusy a případně finalizujeme.
  // Když chybí nebo je poškozený, sjedeme do interaktivního fallbacku — nikdy
  // neoznačujeme nic naslepo.
  if (opts.auto) {
    const applied = await applyAutoReport(phase, state, cwd);
    if (applied.handled) {
      return applied.outcome;
    }
    opts = { ...opts, auto: false };
  }

  const doingStep = phase.steps?.find((s) => s.status === 'doing') ?? null;
  if (doingStep) {
    const moreStepsAfter = (phase.steps ?? []).some(
      (s) => s !== doingStep && s.status !== 'done' && s.status !== 'skipped',
    );
    await finalizeStep(doingStep, moreStepsAfter, opts);
    await save(state, cwd);
    if (doingStep.status !== 'done' && doingStep.status !== 'skipped') {
      return { ok: true };
    }
    if (moreStepsAfter && !opts.auto) {
      log.hint('Další: mini do (pokračovat dalším krokem)');
      return { ok: true };
    }
    if (moreStepsAfter) {
      // v auto módu: krok je hotový, ale zbývají další kroky — fázi zatím nefinalizujeme
      return { ok: true };
    }
    // krok byl poslední — pokračujeme finalizací fáze
  }

  const remainingSteps = (phase.steps ?? []).filter((s) => s.status !== 'done' && s.status !== 'skipped');
  if (remainingSteps.length > 0) {
    log.info(`Fáze ${phase.id} (${phase.title}) má ${remainingSteps.length} ${remainingSteps.length === 1 ? 'nedokončený krok' : 'nedokončených kroků'}:`);
    for (const s of remainingSteps) {
      log.dim(`  - ${s.title}`);
    }
    console.log();

    if (opts.auto) {
      for (const s of remainingSteps) {
        s.status = 'skipped';
      }
      log.dim(`${remainingSteps.length} kroků označeno jako odložené.`);
      phase.status = 'done';
      phase.completedAt = new Date().toISOString();
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'done', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }

    const { decision } = await ask<'decision'>({
      type: 'select',
      name: 'decision',
      message: 'Co s tím?',
      choices: [
        { title: 'Pracovat na dalším kroku', value: 'continue' },
        { title: 'Označit fázi za hotovou (zbylé kroky → odloženo)', value: 'force-done' },
        { title: 'Odložit fázi (přeskočit celou)', value: 'force-skip' },
        { title: 'Zrušit', value: 'cancel' },
      ],
    });

    if (decision === 'cancel') {
      log.dim('Nic se nemění.');
      return { ok: false, reason: 'cancelled' };
    }
    if (decision === 'continue') {
      log.hint('Spusť: mini do');
      return { ok: true };
    }
    for (const s of remainingSteps) {
      s.status = 'skipped';
    }
    log.dim(`${remainingSteps.length} kroků označeno jako odložené.`);

    if (decision === 'force-skip') {
      phase.status = 'skipped';
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'skip', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }
    if (decision === 'force-done') {
      phase.status = 'done';
      phase.completedAt = new Date().toISOString();
      const nextPhase = await collectNotesAndSave(phase, state, cwd, 'done', opts);
      return { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null };
    }
  }

  return finalizePhase(phase, state, cwd, opts);
}

async function collectNotesAndSave(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  outcome: 'done' | 'skip',
  opts: AutoOptions = {},
): Promise<Phase | null> {
  if (!opts.auto) {
    const { notes } = await ask<'notes'>({
      type: 'text',
      name: 'notes',
      message: 'Krátká poznámka (co se povedlo / co je špatně, můžeš nechat prázdné):',
      initial: '',
    });
    const trimmedNotes = (notes as string).trim();
    if (trimmedNotes) {
      phase.humanNotes = trimmedNotes;
    }
  }
  if (outcome === 'done') {
    log.success(`Fáze ${phase.id} (${phase.title}) hotová.`);
  } else {
    log.warn(`Fáze ${phase.id} odložena.`);
  }
  const next = advanceToNextPhase(state);
  logNextPhase(next);
  if (outcome === 'done') {
    await finalizePhaseSideEffects(phase, state, cwd, { bump: opts.bump, push: opts.push });
  }
  await save(state, cwd);
  return next;
}

function logNextPhase(next: Phase | null): void {
  if (next) {
    log.hint(`Pokračuje se fází ${next.id}: ${next.title}. Spusť: mini do`);
  } else {
    log.hint('Žádná další fáze v plánu. Spusť: mini next');
  }
}

/**
 * Sestaví commit message pro hotovou fázi. Subject je krátký a jednoznačný,
 * tělo (pokud existuje) přidává `humanNotes`, které uživatel zapsal v `done`.
 * `goal` ze stavu do těla záměrně nedáváme — duplikuje se s `.mini/state.json`.
 */
export function buildPhaseCommitMessage(phase: Phase): string {
  const subject = `Fáze ${phase.id}: ${phase.title}`;
  const body = phase.humanNotes?.trim();
  if (body) {
    return `${subject}\n\n${body}\n`;
  }
  return subject;
}

/**
 * Side-effecty, které proběhnou po finalizaci fáze jako `done`:
 *
 * 1. **Auto-commit** práce fáze (`commitPhaseWork`) — zapíše `phase.autoCommit`.
 * 2. **Memory záznam** (`writePhaseMemory`) — vytvoří `.mini/memory/phase-{id}-{ts}.md`
 *    a aktualizuje symlink `.mini/last-memory.md`.
 * 3. **Přegenerování grafu** (`regenerateGraph`) — aktualizuje `.mini/graph/`
 *    + `.mini/graph.json` podle nového stavu zdrojáků (po commitu).
 *
 * Společné místo, aby se nezapomnělo zavolat z žádné ze tří finalizačních
 * cest v `done.ts` (`applyAutoReport`, `collectNotesAndSave`, `finalizePhase`).
 *
 * U `skipped` fáze se tahle funkce nevolá — commit ani memory nedávají smysl.
 *
 * Žádný side-effect nikdy nehází — chyby se logují jako warning a workflow
 * pokračuje. Memory soubor i graf jsou záměrně **mimo commit** (commit už
 * proběhl); uživatel je commitne ručně v dalším commitu.
 */
async function finalizePhaseSideEffects(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  finalizeOpts: FinalizeOptions = {},
): Promise<void> {
  await commitPhaseWork(phase, cwd, finalizeOpts);
  await writePhaseMemory(phase, state, cwd, { hasAutoCommit: phase.autoCommit !== undefined });
  await regenerateGraph(cwd);
}

/**
 * Best-effort regenerace `.mini/graph/` + `.mini/graph.json` po hotové fázi. Nikdy nehází —
 * při chybě jen zalogujeme warning a pokračujeme. Pokud projekt nemá co
 * mapovat (žádné TS/PHP/Rust soubory), tiše přeskočíme — jiné jazyky řeší
 * `/graphify`.
 */
async function regenerateGraph(cwd: string): Promise<void> {
  try {
    if (!(await hasMappableProject(cwd))) {
      return;
    }
    const result = await buildGraph(cwd);
    const word = result.fileCount === 1 ? 'soubor' : result.fileCount < 5 ? 'soubory' : 'souborů';
    log.dim(`${GRAPH_DIR}/: regenerováno (${result.fileCount} ${word}).`);
  } catch (err) {
    log.warn(`Mapu projektu se nepodařilo přegenerovat: ${(err as Error).message}`);
  }
}

/**
 * Auto-commit po finalizaci fáze (`phase.status === 'done'`). Nikdy nehází —
 * gitové chyby jenom zalogujeme jako varování, aby přerušený commit nezablokoval
 * `mini done` (uživatel může commitnout ručně).
 *
 * Před commitem navýší verzi v `package.json` (default `patch`), aby ji `git
 * add -A` pobral do commitu fáze. Push se pouští **jen** s `finalizeOpts.push`
 * (opt-in) — jinak zůstává jako dosud jen hint `git push`.
 *
 * Pre-commit HEAD si pamatujeme přímo na `phase.autoCommit`, aby `mini undo`
 * mohl bezpečně udělat soft reset zpět. Volající musí po této funkci ještě
 * uložit state — autoCommit info pak skončí v `state.json`.
 */
async function commitPhaseWork(
  phase: Phase,
  cwd: string,
  finalizeOpts: FinalizeOptions = {},
): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    log.dim('Git repozitář nenalezen — commit přeskočen.');
    return;
  }

  // Bump verze ještě před `hasChanges`/commitem — patří do commitu fáze a sám
  // o sobě je změnou, která má smysl commitnout (i kdyby jinak nic nebylo).
  // Výslednou verzi si držíme pro tag při `--push` (níže).
  const version = await bumpVersion(cwd, finalizeOpts.bump ?? 'patch');

  if (!(await hasChanges(cwd))) {
    log.dim('Žádné změny v gitu — commit přeskočen.');
    return;
  }

  const preSha = await headSha(cwd);

  const message = buildPhaseCommitMessage(phase);
  const r = await commitAll(cwd, message);
  if (!r.ok) {
    log.warn('Git commit selhal.');
    const detail = r.stderr.trim() || r.stdout.trim();
    if (detail) log.dim(detail);
    log.hint('Commit můžeš dokončit ručně: git add -A && git commit');
    return;
  }
  const subject = message.split('\n')[0] ?? message;
  log.success(`Commit: ${subject}`);

  const postSha = await headSha(cwd);
  if (preSha && postSha) {
    phase.autoCommit = { preSha, sha: postSha, subject };
  }

  // Push jen na vyžádání (opt-in). Best-effort: chybějící remote/upstream nebo
  // odmítnutí jen zalogujeme, workflow nezablokujeme.
  if (finalizeOpts.push) {
    const pr = await push(cwd);
    if (pr.ok) {
      log.success('Pushnuto na remote.');
      await tagVersion(cwd, version);
    } else {
      log.warn('Push selhal — práce zůstává commitnutá lokálně.');
      const detail = pr.stderr.trim() || pr.stdout.trim();
      if (detail) log.dim(detail);
      log.hint('Zkus ručně: git push (případně nastav upstream přes git push -u).');
    }
  } else {
    log.hint('Pro nahrání na remote spusť: git push (nebo mini done --push).');
  }
}

/**
 * Při `--push` po úspěšném pushi založí a pushne git tag `v<verze>` podle
 * aktuální verze z `package.json`. Best-effort jako okolní push logika —
 * gitové chyby (existující tag, chybějící remote) jen zalogujeme jako warning.
 *
 * Když projekt verzi nemá (`version === null` — jiný jazyk bez `package.json`),
 * tiše přeskočíme; tagovat není podle čeho.
 */
async function tagVersion(cwd: string, version: string | null): Promise<void> {
  if (!version) return;

  const tag = `v${version}`;
  const tr = await createTag(cwd, tag);
  if (!tr.ok) {
    log.warn(`Tag ${tag} se nepodařilo vytvořit — push verze přeskočen.`);
    const detail = tr.stderr.trim() || tr.stdout.trim();
    if (detail) log.dim(detail);
    return;
  }

  const ptr = await pushTag(cwd, tag);
  if (ptr.ok) {
    log.success(`Tag ${tag} pushnut na remote.`);
  } else {
    log.warn(`Push tagu ${tag} selhal — tag zůstává lokálně.`);
    const detail = ptr.stderr.trim() || ptr.stdout.trim();
    if (detail) log.dim(detail);
    log.hint(`Zkus ručně: git push origin ${tag}.`);
  }
}

/**
 * Best-effort navýšení verze v `package.json` před commitem fáze. Když projekt
 * `package.json` nemá (jiný jazyk), tiše přeskočí. Chybu při zápisu jen
 * zalogujeme — nesmí zablokovat finalizaci.
 */
async function bumpVersion(
  cwd: string,
  level: NonNullable<FinalizeOptions['bump']>,
): Promise<string | null> {
  try {
    const r = await bumpPackageVersion(cwd, level);
    if (r) {
      log.dim(`Verze: ${r.from} → ${r.to} (${level}).`);
      return r.to;
    }
  } catch (err) {
    log.warn(`Navýšení verze selhalo: ${(err as Error).message}`);
  }
  return null;
}

export function advanceToNextPhase(state: ProjectState): Phase | null {
  closeOrphanedDoingParents(state);
  const nextPhase =
    state.phases.find(
      (p) => p.id !== state.currentPhaseId && (p.status === 'proposed' || p.status === 'planned'),
    ) ?? null;
  state.currentPhaseId = nextPhase ? nextPhase.id : null;
  return nextPhase;
}

/**
 * Dozavře osiřelé rodičovské fáze. Po `block`-verify vznikne opravná podfáze
 * (float ID) a `advanceToNextPhase` se na ni posune — rodič přitom zůstane ve
 * stavu `doing` (nastaveno v `do.ts`) a sám se na něj už nikdy nevrátíme.
 * Jakmile jsou všechny jeho podfáze uzavřené (`done`/`skipped`), je rodič
 * hotový (všechny jeho kroky byly `done` už před vznikem podfáze, jinak by se
 * verify nespustil) — uzavřeme ho jako `done`. Voláno z `advanceToNextPhase`,
 * takže reconciliace proběhne po dokončení každé fáze.
 *
 * Top-level fázi, která se zrovna normálně dělá (a žádné podfáze nemá), se to
 * netýká — bez podfází se nikdy neuzavře.
 */
function closeOrphanedDoingParents(state: ProjectState): void {
  for (const parent of state.phases) {
    if (parent.status !== 'doing') continue;
    const subs = state.phases.filter(
      (p) => p.id !== parent.id && Math.floor(p.id) === parent.id,
    );
    if (subs.length === 0) continue;
    if (!subs.every((s) => s.status === 'done' || s.status === 'skipped')) continue;
    parent.status = 'done';
    parent.completedAt = new Date().toISOString();
    log.success(`Fáze ${parent.id} (${parent.title}) uzavřena — opravná podfáze hotová.`);
  }
}

async function finalizeStep(step: Step, moreStepsLeft: boolean, opts: AutoOptions = {}): Promise<void> {
  let outcome: 'done' | 'keep' | 'skip';
  if (opts.auto) {
    outcome = 'done';
  } else {
    const answer = await ask<'outcome'>({
      type: 'select',
      name: 'outcome',
      message: `Krok "${step.title}" — jak to dopadlo?`,
      choices: [
        { title: 'Hotovo, funguje', value: 'done' },
        { title: 'Ještě ne, nech ho doing', value: 'keep' },
        { title: 'Odložit (přeskočit)', value: 'skip' },
      ],
    });
    outcome = answer.outcome as 'done' | 'keep' | 'skip';
  }

  if (outcome === 'keep') {
    log.dim('Krok zůstává jako "dělá se".');
    return;
  }
  if (outcome === 'skip') {
    step.status = 'skipped';
    log.warn(`Krok "${step.title}" odložen.`);
    return;
  }

  step.status = 'done';
  log.success(`Krok "${step.title}" hotov.`);

  if (moreStepsLeft) {
    return;
  }

  log.info('To byl poslední krok fáze.');
}

type AutoApplyResult =
  | { handled: true; outcome: StepOutcome }
  | { handled: false };

export interface ApplyReportOptions extends FinalizeOptions {
  /**
   * Lidská verifikace (`verify` body) už proběhla mimo tenhle proces — typicky
   * v Claude session dotazem v chatu (`/mini:done`). Při `true` se pending
   * verify body neptají interaktivně, ale berou se jako odsouhlasené (pass).
   */
  acceptVerify?: boolean;
}

export async function applyAutoReport(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  applyOpts: ApplyReportOptions = {},
): Promise<AutoApplyResult> {
  const expectedStepTitles = (phase.steps ?? []).map((s) => s.title);
  const reportFile = runReportPath(cwd, phase.id);

  let report: RunReport | null;
  try {
    report = await readRunReport(cwd, {
      expectedPhaseId: phase.id,
      expectedStepTitles,
    });
  } catch (err) {
    if (err instanceof RunReportParseError) {
      log.warn(`Report fáze ${phase.id} je poškozený: ${err.message}`);
      log.dim(`Soubor: ${reportFile}`);
      log.dim('Přepínám do interaktivního módu — projdeme kroky ručně.');
      return { handled: false };
    }
    throw err;
  }

  if (!report) {
    log.warn(`Report fáze ${phase.id} nenalezen (${reportFile}).`);
    log.dim('Přepínám do interaktivního módu — projdeme kroky ručně.');
    return { handled: false };
  }

  for (const reported of report.steps) {
    const step = phase.steps?.find((s) => s.title === reported.title);
    if (!step) continue;
    if (reported.status === 'done') {
      step.status = 'done';
    } else if (reported.status === 'skipped') {
      step.status = 'skipped';
    } else {
      // `blocked` i `todo` znamenají, že krok není uzavřený — retry pokus
      // ho najde jako `todo` a pošle Claudovi znovu.
      step.status = 'todo';
    }
  }

  const remaining = (phase.steps ?? []).filter(
    (s) => s.status !== 'done' && s.status !== 'skipped',
  );

  if (!phase.steps?.length) {
    if (report.verdict !== 'done') {
      log.warn(`Fáze ${phase.id}: verdict reportu je "${report.verdict}" — fázi nezavírám.`);
      await save(state, cwd);
      return { handled: true, outcome: { ok: true } };
    }
  } else if (remaining.length > 0) {
    log.warn(
      `Fáze ${phase.id}: zbývá ${remaining.length} ${remaining.length === 1 ? 'nedokončený krok' : 'nedokončených kroků'} (verdict: ${report.verdict}).`,
    );
    for (const s of remaining) {
      log.dim(`  - ${s.title}`);
    }
    await save(state, cwd);
    return { handled: true, outcome: { ok: true } };
  }

  // Body k ručnímu ověření zobrazíme až tady — všechny kroky jsou uzavřené a
  // fázi bychom jinak rovnou zavřeli. I v auto módu se tu zastavíme a zeptáme
  // se člověka (volání `ask()`); auto loop verify neobchází.
  const verifyOutcome = await handleVerify(report.verify, phase, state, cwd, applyOpts);
  if (verifyOutcome) {
    return { handled: true, outcome: verifyOutcome };
  }

  phase.status = 'done';
  phase.completedAt = new Date().toISOString();
  log.success(`Fáze ${phase.id} (${phase.title}) hotová.`);
  const nextPhase = advanceToNextPhase(state);
  logNextPhase(nextPhase);
  await finalizePhaseSideEffects(phase, state, cwd, { bump: applyOpts.bump, push: applyOpts.push });
  await save(state, cwd);
  return {
    handled: true,
    outcome: { ok: true, phaseAdvanced: true, nextPhaseId: nextPhase?.id ?? null },
  };
}

/**
 * Projde body k ručnímu ověření (`verify` z reportu) s člověkem. Volá se až
 * při uzavírání fáze, kdy jsou všechny kroky hotové. Vrací:
 *
 * - `null` — žádné verify body, nebo všechny `pass`/`skip`: fázi lze zavřít,
 * - `{ ok: false, reason: 'verify-issue' }` — aspoň jeden `issue` (a žádný
 *   blocker): fázi nezavíráme, uživatel ji po opravě zavře znovu (`mini done`),
 * - `{ ok: true, phaseAdvanced: true, ... }` — aspoň jeden `block`: vytvoříme
 *   opravnou podfázi (float ID) a posuneme se na ni.
 *
 * I v auto módu se tu volá `ask()` — verify se nikdy neobchází automaticky.
 * Bez interaktivního terminálu (CI, pipe) se ale `ask()` nevolá vůbec: fázi
 * nezavřeme a vrátíme `verify-needs-human`, aby verify tiše neprošlo jako pass.
 *
 * Body, které člověk v minulém průchodu už odbavil (`pass`/`skip`), si pamatuje
 * `phase.resolvedVerify` — při opakovaném `mini done` nad stejným reportem se
 * znovu nenabízejí.
 */
async function handleVerify(
  verify: RunReportVerifyItem[],
  phase: Phase,
  state: ProjectState,
  cwd: string,
  applyOpts: ApplyReportOptions = {},
): Promise<StepOutcome | null> {
  // Body vyřešené dřívějším průchodem (pass/skip) přeskočíme — opakovaný
  // `mini done` nad neměnícím se reportem je nesmí přehrávat znovu (W4).
  const alreadyResolved = new Set(phase.resolvedVerify ?? []);
  const pending = verify.filter((v) => !alreadyResolved.has(v.title));
  if (pending.length === 0) {
    return null;
  }

  // `/mini:done`: lidská verifikace proběhla v chatu, sem dorazil souhlas přes
  // `--accept-verify`. Body bereme jako pass (zapamatujeme do resolvedVerify,
  // ať se při opakování neptáme znovu) a fázi necháme zavřít.
  if (applyOpts.acceptVerify) {
    phase.resolvedVerify = [...(phase.resolvedVerify ?? []), ...pending.map((v) => v.title)];
    return null;
  }

  // Bez TTY se `ask()` nedá bezpečně použít (vrací undefined → tiše pass).
  // Fázi proto nezavíráme a předáme štafetu člověku do interaktivního běhu.
  if (!isInteractive()) {
    const w =
      pending.length === 1 ? 'bod k ručnímu ověření' : 'bodů k ručnímu ověření';
    log.warn(
      `Fáze ${phase.id} (${phase.title}): ${pending.length} ${w} vyžaduje člověka, ale běžím bez interaktivního terminálu — fázi nezavírám.`,
    );
    for (const it of pending) {
      log.dim(`  - ${it.title}`);
    }
    log.hint('Spusť `mini done` (nebo `mini auto`) v terminálu a body ověř ručně.');
    await save(state, cwd);
    return { ok: false, reason: 'verify-needs-human' };
  }

  const word = pending.length === 1 ? 'bod k ručnímu ověření' : 'bodů k ručnímu ověření';
  log.info(`Fáze ${phase.id} (${phase.title}): ${pending.length} ${word} (Claude je sám neověřil):`);
  console.log();

  const blockers: RunReportVerifyItem[] = [];
  const issues: RunReportVerifyItem[] = [];
  const newlyResolved: string[] = [];

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]!;
    log.info(`  ${i + 1}. ${item.title}`);
    if (item.detail) {
      log.dim(`     ${item.detail}`);
    }
    const { answer } = await ask<'answer'>({
      type: 'select',
      name: 'answer',
      message: 'Ověřeno?',
      choices: [
        { title: 'Ano, funguje (pass)', value: 'pass' },
        { title: 'Přeskočit ověření, beru zodpovědnost na sebe (skip)', value: 'skip' },
        { title: 'Drobný problém — chci ho opravit (issue)', value: 'issue' },
        { title: 'Závažný bloker — vytvoř opravnou podfázi (block)', value: 'block' },
      ],
    });
    if (answer === 'issue') {
      issues.push(item);
    } else if (answer === 'block') {
      blockers.push(item);
    } else {
      // pass | skip — bod je odbavený, ať se příště znovu nenabízí.
      newlyResolved.push(item.title);
    }
  }

  if (newlyResolved.length > 0) {
    phase.resolvedVerify = [...(phase.resolvedVerify ?? []), ...newlyResolved];
  }

  // Bloker má přednost: založíme opravnou podfázi a posuneme se na ni.
  if (blockers.length > 0) {
    const sub = insertFixSubphase(state, phase, blockers);
    log.warn(
      `Fáze ${phase.id} se neuzavírá — našel se ${blockers.length === 1 ? 'bloker' : 'blokery'}. Vytvořil jsem opravnou podfázi ${sub.id}.`,
    );
    for (const s of sub.steps ?? []) {
      log.dim(`  - ${s.title}`);
    }
    const next = advanceToNextPhase(state);
    logNextPhase(next);
    await save(state, cwd);
    return { ok: true, phaseAdvanced: true, nextPhaseId: next?.id ?? null };
  }

  // Drobné problémy bez blokeru: fázi nezavřeme, uživatel ji po opravě zavře znovu.
  if (issues.length > 0) {
    log.warn(
      `Fáze ${phase.id} se neuzavírá — ${issues.length === 1 ? 'bod má problém' : 'bodů má problém'}:`,
    );
    for (const it of issues) {
      log.dim(`  - ${it.title}`);
    }
    log.hint('Oprav uvedené body (`mini do`) a pak fázi zavři znovu (`mini done`).');
    await save(state, cwd);
    return { ok: false, reason: 'verify-issue' };
  }

  // Všechny body pass/skip — fázi lze zavřít.
  return null;
}

/**
 * Vloží opravnou podfázi hned za mateřskou fázi v `phases` array. Float ID
 * (21 → 21.1 → 21.2…), status `planned`, kroky mechanicky z blokerů (každý
 * blocker → jeden krok). Fyzická pozice za rodičem je důležitá: `advanceToNextPhase`
 * bere první `proposed/planned` fázi v pořadí pole, takže podfáze musí stát hned
 * za rodičem, jinak by se přeskočila.
 */
function insertFixSubphase(
  state: ProjectState,
  parent: Phase,
  blockers: RunReportVerifyItem[],
): Phase {
  const id = nextSubphaseId(state, parent.id);
  const steps: Step[] = blockers.map((b) => ({
    title: b.title,
    status: 'todo' as const,
    ...(b.detail ? { notes: b.detail } : {}),
  }));
  const sub: Phase = {
    id,
    title: `Oprava: ${parent.title}`,
    goal: `Vyřešit blokery z ručního ověření fáze ${parent.id}.`,
    status: 'planned',
    steps,
  };
  const idx = state.phases.findIndex((p) => p.id === parent.id);
  state.phases.splice(idx + 1, 0, sub);
  return sub;
}

/**
 * Další volné float ID podfáze pro daného rodiče. 21 bez podfází → 21.1,
 * jinak nejvyšší existující + 0.1 (zaokrouhleno na jedno desetinné místo,
 * aby float aritmetika nedala 21.200000000000003).
 */
function nextSubphaseId(state: ProjectState, parentId: number): number {
  const subs = state.phases.filter(
    (p) => Math.floor(p.id) === parentId && p.id !== parentId,
  );
  const base = subs.length === 0 ? parentId : Math.max(...subs.map((p) => p.id));
  return Math.round((base + 0.1) * 10) / 10;
}

async function finalizePhase(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  opts: AutoOptions = {},
): Promise<StepOutcome> {
  let outcome: 'done' | 'keep' | 'skip';
  if (opts.auto) {
    outcome = 'done';
  } else {
    const answer = await ask<'outcome'>({
      type: 'select',
      name: 'outcome',
      message: `Fáze ${phase.id} (${phase.title}) — co s ní?`,
      choices: [
        { title: 'Hotová, funguje', value: 'done' },
        { title: 'Ještě ne, nech ji doing', value: 'keep' },
        { title: 'Odložit (přeskočit fázi)', value: 'skip' },
      ],
    });
    outcome = answer.outcome as 'done' | 'keep' | 'skip';
  }

  if (outcome === 'keep') {
    log.dim('Fáze zůstává jako rozdělaná.');
    return { ok: true };
  }

  if (!opts.auto) {
    const { notes } = await ask<'notes'>({
      type: 'text',
      name: 'notes',
      message: 'Krátká poznámka (co se povedlo / co je špatně, můžeš nechat prázdné):',
      initial: '',
    });
    const trimmedNotes = (notes as string).trim();
    if (trimmedNotes) {
      phase.humanNotes = trimmedNotes;
    }
  }

  if (outcome === 'skip') {
    phase.status = 'skipped';
    log.warn(`Fáze ${phase.id} odložena.`);
  } else {
    phase.status = 'done';
    phase.completedAt = new Date().toISOString();
    log.success(`Fáze ${phase.id} (${phase.title}) hotová.`);
  }

  const next = advanceToNextPhase(state);
  logNextPhase(next);
  if (phase.status === 'done') {
    await finalizePhaseSideEffects(phase, state, cwd, { bump: opts.bump, push: opts.push });
  }
  await save(state, cwd);
  return { ok: true, phaseAdvanced: true, nextPhaseId: next?.id ?? null };
}

/**
 * Neinteraktivní posun stavu podle reportu — pro `mini done --apply` (volá ho
 * `/mini:done`, když uživatel v session potvrdil, že fáze funguje). Sdílí
 * `applyAutoReport` s auto módem: přečte report, posune kroky, případně uzavře
 * fázi (commit + memory + graf + posun na další). Na rozdíl od `done({auto})`
 * **nepadá do interaktivního fallbacku** — když report chybí nebo je poškozený,
 * vrátí chybu, ať Bash volání selže čistě místo zaseknutí na `ask()`.
 */
export async function applyDone(
  cwd: string = process.cwd(),
  opts: ApplyReportOptions = {},
): Promise<StepOutcome> {
  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return { ok: false, reason: 'no-project' };
  }

  const state = await load(cwd);

  if (state.currentPhaseId === null) {
    log.warn('Žádná aktuální fáze.');
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'no-current-phase' };
  }

  const phase = state.phases.find((p) => p.id === state.currentPhaseId);
  if (!phase) {
    log.error('Stav je nekonzistentní (currentPhaseId odkazuje na neexistující fázi).');
    return { ok: false, reason: 'inconsistent-state' };
  }

  if (phase.status === 'done') {
    log.info(`Fáze ${phase.id} (${phase.title}) už je hotová.`);
    log.hint('Spusť: mini next');
    return { ok: false, reason: 'phase-done' };
  }

  const applied = await applyAutoReport(phase, state, cwd, opts);
  if (!applied.handled) {
    log.error(`Report fáze ${phase.id} chybí nebo je poškozený — stav neumím posunout neinteraktivně.`);
    log.hint('Nejdřív spusť `/mini:do` (zapíše report), nebo stav posuň ručně přes `mini done`.');
    return { ok: false, reason: 'no-report' };
  }
  // Fáze se opravdu uzavřela (ne jen verify-needs-human apod.) → nabídni vyčištění
  // kontextu. `/clear` musí napsat člověk, my ho jen připomeneme.
  if (applied.outcome.ok && applied.outcome.phaseAdvanced) {
    log.hint('Hotovo. Pro vyčištění kontextu Claude Code před další fází zvaž `/clear`.');
  }
  return applied.outcome;
}
