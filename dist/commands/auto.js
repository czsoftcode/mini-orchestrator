import { rename } from 'node:fs/promises';
import { join } from 'node:path';
import { RUN_DIR, previousRunReportPath, runReportPath, } from '../state/runReport.js';
import { exists, load, phaseStem } from '../state/store.js';
import { log } from '../ui/log.js';
import { doPhase } from './do.js';
import { done } from './done.js';
import { next } from './next.js';
import { plan } from './plan.js';
/**
 * Maximální počet průchodů Claude session na jednu fázi v auto módu.
 *
 * Auto pouští Claude na celou fázi v jednom průchodu. Pokud po `done({auto})`
 * zbydou kroky se statusem `todo` (Claude nestihl, narazil na blocker apod.),
 * spustí se další pokus — celkem maximálně tolik, kolik říká tahle konstanta.
 * Po vyčerpání limitu auto skončí s warningem a předá štafetu člověku.
 */
const MAX_PHASE_ITERATIONS = 3;
export async function auto(opts = {}) {
    const cwd = process.cwd();
    if (!(await exists(cwd))) {
        log.warn('V tomto adresáři není projekt.');
        log.hint('Začni: mini init');
        return;
    }
    let state = await load(cwd);
    let currentPhase = state.currentPhaseId !== null ? state.phases.find((p) => p.id === state.currentPhaseId) : undefined;
    const needsNewPhase = !currentPhase || currentPhase.status === 'done' || currentPhase.status === 'skipped';
    if (needsNewPhase) {
        log.title('[auto 1/4] Navrhuji další fázi');
        const r = await next({ auto: true });
        if (!r.ok) {
            log.dim(`Auto skončil v next (${r.reason}).`);
            return;
        }
        state = await load(cwd);
        currentPhase = state.phases.find((p) => p.id === state.currentPhaseId);
        if (!currentPhase) {
            log.error('Něco se pokazilo (nová fáze se nenajde ve stavu).');
            return;
        }
    }
    else if (currentPhase) {
        log.title(`[auto 1/4] Pokračujem na rozdělané fázi ${currentPhase.id}: ${currentPhase.title}`);
    }
    if (!currentPhase) {
        return;
    }
    if (!currentPhase.steps?.length) {
        log.title('[auto 2/4] Rozmenění fáze na kroky');
        const r = await plan({ auto: true });
        if (!r.ok) {
            log.dim(`Auto skončil v plan (${r.reason}).`);
            return;
        }
    }
    else {
        log.title(`[auto 2/4] Fáze už má ${currentPhase.steps.length} kroků — planování přeskočeno.`);
    }
    // Jeden Claude session = celá fáze. Pokud po verifikaci přes `done({auto})`
    // zbydou neuzavřené kroky, pustíme další pokus (až do MAX_PHASE_ITERATIONS).
    // Druhý a třetí průchod dostávají retry kontext — Claude tak v promptu uvidí,
    // že pokračuje předchozí pokus, a najde tam cestu k zálohovanému reportu.
    let iteration = 0;
    while (true) {
        iteration += 1;
        const retry = iteration > 1 ? await prepareRetryContext(cwd, currentPhase.id, iteration) : null;
        const labelSuffix = iteration === 1 ? '' : ` — pokus ${iteration}/${MAX_PHASE_ITERATIONS}`;
        log.title(`[auto 3/4] Spouštím Claude Code (acceptEdits)${labelSuffix}`);
        const dr = await doPhase({ auto: true, maxTurns: opts.maxTurns, retry });
        if (!dr.ok) {
            log.dim(`Auto skončil v do (${dr.reason}).`);
            return;
        }
        log.title(`[auto 4/4] Verifikace${labelSuffix}`);
        const fr = await done({ auto: true, bump: opts.bump, push: opts.push });
        if (!fr.ok) {
            log.dim(`Auto skončil v done (${fr.reason}).`);
            return;
        }
        if (fr.phaseAdvanced) {
            if (fr.nextPhaseId === null || fr.nextPhaseId === undefined) {
                log.success('Auto hotov. Žádná další fáze v plánu — spusť: mini next.');
            }
            else {
                log.success(`Auto hotov. Pokračuje se fází ${fr.nextPhaseId} — spusť: mini auto.`);
            }
            return;
        }
        if (iteration >= MAX_PHASE_ITERATIONS) {
            log.warn(`Po ${MAX_PHASE_ITERATIONS} pokusech fáze ${currentPhase.id} pořád není hotová. Zkontroluj report v .mini/run/ a pokračuj ručně přes mini do / mini done.`);
            return;
        }
        log.dim(`Fáze ${currentPhase.id} pořád není hotová — spouštím další pokus.`);
    }
}
/**
 * Připraví podklady pro retry: přejmenuje aktuální report na `.prev.md`,
 * aby ho Claude mohl přečíst bez kolize s novým zápisem. Když report
 * neexistuje (Claude předchozí session ukončil bez zápisu — crash, /exit,
 * vyčerpaný `--max-turns`), retry pojede bez kontextu předchozího reportu;
 * statusy kroků si Claude vyčte z bloku „Kroky" v promptu.
 */
async function prepareRetryContext(cwd, phaseId, iteration) {
    const current = runReportPath(cwd, phaseId);
    const previous = previousRunReportPath(cwd, phaseId);
    try {
        await rename(current, previous);
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }
    return {
        iteration,
        previousReportPath: join(RUN_DIR, `${phaseStem(phaseId)}.prev.md`),
    };
}
