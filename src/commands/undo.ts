import { exists, hasPrev, load, loadPrev, restorePrev } from '../state/store.js';
import type { ProjectState } from '../state/types.js';
import { ask } from '../ui/ask.js';
import { log } from '../ui/log.js';

export async function undo(): Promise<void> {
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

  console.log();
  log.title('Vrátit poslední změnu?');
  log.dim(`  ${summary}`);
  console.log();

  const { confirm } = await ask<'confirm'>({
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
  log.success('Stav vrácen o krok zpět.');
  log.hint('Mini si pamatuje jen jeden krok zpět — další undo už neudělá.');
}

function describeDiff(current: ProjectState, prev: ProjectState): string {
  const parts: string[] = [];

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

function phaseLabel(state: ProjectState, id: number | null): string {
  if (id === null) {
    return '(žádná)';
  }
  const p = state.phases.find((x) => x.id === id);
  return p ? `${id} (${p.title})` : `${id} (neznámá)`;
}

function collectStatusChanges(current: ProjectState, prev: ProjectState): string[] {
  const out: string[] = [];
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
