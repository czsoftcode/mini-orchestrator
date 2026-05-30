/**
 * Runner: změří token cenu promptů mini příkazů nad REÁLNÝM stavem tohoto repa
 * a vypíše žebříček + zapíše `.mini/token-report.md`.
 *
 * Čistou logiku drží `src/tokens/measure.ts` (testovaná ve vitestu). Tady jen
 * z disku skládáme reálné vstupy (projectMd, fáze, poznámky, report) a tiskneme.
 *
 * Spouští se přes tsx (nepotřebuje build):  npm run measure-tokens
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LAST_MEMORY_FILE } from '../src/prompts/writeMemory.js';
import { readDiscussNotes } from '../src/state/discussNotes.js';
import { readRunReport } from '../src/state/runReport.js';
import { exists, loadHeader, loadPhase, readProject } from '../src/state/store.js';
import type { Phase, Step } from '../src/state/types.js';
import {
  type PhaseLite,
  type RealInputs,
  measureAll,
  rankMeasurements,
  renderConsole,
  renderReportMarkdown,
} from '../src/tokens/measure.js';

const REPORT_PATH = '.mini/token-report.md';

/** Reprezentativní krok pro `do` — první nedokončený, jinak první, jinak null. */
function representativeStep(phase: Phase): Step | null {
  const steps = phase.steps ?? [];
  return steps.find((s) => s.status === 'todo' || s.status === 'doing') ?? steps[0] ?? null;
}

async function readLastMemory(cwd: string): Promise<string> {
  try {
    return await readFile(join(cwd, LAST_MEMORY_FILE), 'utf-8');
  } catch {
    return '';
  }
}

async function loadRealInputs(cwd: string): Promise<RealInputs> {
  const [projectMd, header] = await Promise.all([readProject(cwd), loadHeader(cwd)]);

  const phases: PhaseLite[] = header.phases.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
  }));

  // Reprezentativní fáze: aktuální, jinak poslední v indexu. Když nejde načíst
  // detail (nebo žádná fáze není), použijeme placeholder — runner nesmí spadnout.
  const repId = header.currentPhaseId ?? header.phases.at(-1)?.id ?? null;
  const phase: Phase =
    (repId !== null ? await loadPhase(cwd, repId) : null) ??
    ({ id: repId ?? 0, title: '(žádná fáze)', status: 'proposed' } as Phase);

  const discussNotes = (await readDiscussNotes(cwd, phase.id)) ?? '';
  const lastMemoryMd = await readLastMemory(cwd);

  // Run report čteme tolerantně — chybějící/poškozený = prázdno.
  let reportBody = '';
  let verify: RealInputs['verify'] = [];
  try {
    const report = await readRunReport(cwd, phase.id);
    if (report) {
      reportBody = report.body ?? '';
      verify = report.verify;
    }
  } catch {
    // necháme prázdno
  }

  return {
    projectMd,
    phases,
    phase,
    lastMemoryMd,
    discussNotes,
    reportBody,
    verify,
    focusedStep: representativeStep(phase),
  };
}

async function main(): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    console.error('V tomto adresáři není projekt (.mini/state.json). Spusť `mini init`.');
    process.exitCode = 1;
    return;
  }

  const inputs = await loadRealInputs(cwd);
  const ranked = rankMeasurements(measureAll(inputs));

  // Konzole
  console.log(renderConsole(ranked));

  // Report na disk (čistý markdown + patička s metadaty)
  const md = `${renderReportMarkdown(ranked)}\n_Vygenerováno ${new Date().toISOString()} · reprezentativní fáze: ${inputs.phase.id}._\n`;
  await writeFile(join(cwd, REPORT_PATH), md, 'utf-8');
  console.log(`\nReport zapsán do ${REPORT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
