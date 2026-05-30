import { headSha, isCleanWorkingTree, isGitRepo, softResetTo } from '../git.js';
import { exists, hasPrev, load, loadPrev, restorePrev } from '../state/store.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';
export async function undo() {
    const cwd = process.cwd();
    if (!(await exists(cwd))) {
        log.warn('V tomto adresáři není projekt.');
        return;
    }
    if (!(await hasPrev(cwd))) {
        log.warn('Není co vrátit (žádná předchozí verze stavu).');
        log.hint('Mini si pamatuje jen jeden krok zpět.');
        return;
    }
    const [current, prev] = await Promise.all([load(cwd), loadPrev(cwd)]);
    const summary = describeDiff(current, prev);
    const autoCommit = findRevertedAutoCommit(current, prev);
    const decision = await classifyRevert(cwd, autoCommit);
    console.log();
    log.title('Vrátit poslední změnu?');
    log.dim(`  ${summary}`);
    if (decision.kind === 'match') {
        log.dim(`  + revert commitu: ${decision.autoCommit.subject} (soft reset na ${shortSha(decision.autoCommit.preSha)})`);
    }
    else if (decision.kind === 'mismatch') {
        log.dim(`  commit "${decision.autoCommit.subject}" zůstane (${decision.reason}).`);
    }
    console.log();
    const { confirm } = await ask({
        type: 'confirm',
        name: 'confirm',
        message: 'Provést?',
        initial: true,
    });
    if (!confirm) {
        log.dim('Nic se nemění.');
        return;
    }
    await restorePrev(cwd);
    if (decision.kind === 'match') {
        const r = await softResetTo(cwd, decision.autoCommit.preSha);
        if (r.ok) {
            log.success('Stav vrácen a auto-commit zrušen (soft reset, změny zůstaly v indexu).');
        }
        else {
            log.warn('Stav vrácen, ale soft reset commitu selhal.');
            const detail = r.stderr.trim() || r.stdout.trim();
            if (detail)
                log.dim(detail);
            log.hint(`Commit zrušíš ručně: git reset --soft ${decision.autoCommit.preSha}`);
        }
    }
    else if (decision.kind === 'mismatch') {
        log.success('Stav vrácen o krok zpět.');
        log.warn(`Auto-commit "${decision.autoCommit.subject}" zůstal v gitu (${decision.reason}).`);
        log.hint(`Pokud ho chceš taky vrátit, ručně: git reset --soft ${decision.autoCommit.preSha}`);
    }
    else {
        log.success('Stav vrácen o krok zpět.');
    }
    log.hint('Mini si pamatuje jen jeden krok zpět — další undo už neudělá.');
}
/**
 * Hledá fázi, která byla v `current` opatřena novým `autoCommit`, ale v `prev`
 * žádný (nebo jiný) auto-commit neměla. To je signál, že `mini done`
 * v posledním kroku auto-commitnul a `undo` mu může nabídnout revert.
 */
function findRevertedAutoCommit(current, prev) {
    for (const p of current.phases) {
        if (!p.autoCommit)
            continue;
        const pp = prev.phases.find((x) => x.id === p.id);
        if (!pp?.autoCommit || pp.autoCommit.sha !== p.autoCommit.sha) {
            return p.autoCommit;
        }
    }
    return null;
}
async function classifyRevert(cwd, autoCommit) {
    if (!autoCommit)
        return { kind: 'none' };
    if (!(await isGitRepo(cwd))) {
        return { kind: 'mismatch', autoCommit, reason: 'nejsme v git repu' };
    }
    const head = await headSha(cwd);
    if (head !== autoCommit.sha) {
        return {
            kind: 'mismatch',
            autoCommit,
            reason: 'HEAD se mezitím posunul',
        };
    }
    if (!(await isCleanWorkingTree(cwd))) {
        return {
            kind: 'mismatch',
            autoCommit,
            reason: 'v pracovním stromě jsou neuložené změny',
        };
    }
    return { kind: 'match', autoCommit };
}
function shortSha(sha) {
    return sha.slice(0, 7);
}
function describeDiff(current, prev) {
    const parts = [];
    if (current.phases.length !== prev.phases.length) {
        const diff = current.phases.length - prev.phases.length;
        parts.push(diff > 0 ? `odebere se ${diff} ${diff === 1 ? 'fáze' : 'fází'}` : `vrátí se ${-diff} ${-diff === 1 ? 'fáze' : 'fází'}`);
    }
    if (current.currentPhaseId !== prev.currentPhaseId) {
        const curLabel = phaseLabel(current, current.currentPhaseId);
        const prevLabel = phaseLabel(prev, prev.currentPhaseId);
        parts.push(`aktuální fáze: ${curLabel} → ${prevLabel}`);
    }
    const statusChanges = collectStatusChanges(current, prev);
    for (const c of statusChanges) {
        parts.push(c);
    }
    return parts.length > 0 ? parts.join('; ') : 'jemné změny ve stavu';
}
function phaseLabel(state, id) {
    if (id === null) {
        return '(žádná)';
    }
    const p = state.phases.find((x) => x.id === id);
    return p ? `${id} (${p.title})` : `${id} (neznámá)`;
}
function collectStatusChanges(current, prev) {
    const out = [];
    for (const cp of current.phases) {
        const pp = prev.phases.find((x) => x.id === cp.id);
        if (!pp) {
            continue;
        }
        if (pp.status !== cp.status) {
            out.push(`fáze ${cp.id}: ${cp.status} → ${pp.status}`);
        }
        if (cp.steps && pp.steps) {
            for (let i = 0; i < cp.steps.length; i++) {
                const cs = cp.steps[i];
                const ps = pp.steps[i];
                if (cs && ps && cs.title === ps.title && cs.status !== ps.status) {
                    out.push(`krok "${cs.title}": ${cs.status} → ${ps.status}`);
                }
            }
        }
    }
    return out;
}
