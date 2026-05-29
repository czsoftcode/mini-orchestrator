import { MODEL_SCOPES, SCOPE_LABELS, type ModelScope } from '../state/models.js';
import { exists, load, save } from '../state/store.js';
import type { ProjectState } from '../state/types.js';
import { ask, nonEmpty, trim } from '../ui/ask.js';
import { log } from '../ui/log.js';

interface Preset {
  alias: string;
  hint: string;
}

const PRESETS: Preset[] = [
  { alias: 'opus', hint: 'nejlepší kvalita, pomalejší, váží víc na limitu' },
  { alias: 'sonnet', hint: 'vyvážený' },
  { alias: 'haiku', hint: 'rychlý, levný, na jednoduché věci' },
];

const SCOPE_SET = new Set<string>(MODEL_SCOPES);

export async function model(arg1?: string, arg2?: string): Promise<void> {
  const cwd = process.cwd();

  if (!(await exists(cwd))) {
    log.warn('V tomto adresáři není projekt.');
    log.hint('Začni: mini init');
    return;
  }

  const state = await load(cwd);

  if (!arg1) {
    showCurrent(state);
    await interactivePicker(state, cwd);
    return;
  }

  if (arg1 === 'show' || arg1 === 'list') {
    showCurrent(state);
    return;
  }

  if (arg1 === 'reset') {
    delete state.model;
    delete state.models;
    await save(state, cwd);
    log.success('Všechny modely smazány (Claude Code použije svůj default).');
    return;
  }

  if (SCOPE_SET.has(arg1)) {
    const scope = arg1 as ModelScope;
    if (arg2) {
      await setScope(state, scope, arg2, cwd);
    } else {
      await interactiveModelForScope(state, scope, cwd);
    }
    return;
  }

  if (arg2) {
    log.error(`Neznámý rozsah: "${arg1}". Použij: ${MODEL_SCOPES.join(' / ')}.`);
    return;
  }

  await setScope(state, 'default', arg1, cwd);
}

function showCurrent(state: ProjectState): void {
  console.log();
  log.title('Modely pro tento projekt');
  const m = state.models ?? {};
  const lines: string[] = [];
  for (const scope of MODEL_SCOPES) {
    const value = m[scope];
    if (value) {
      lines.push(`  ${scope.padEnd(11)} ${value}`);
    } else {
      lines.push(`  ${scope.padEnd(11)} (zděděno z default / Claude Code)`);
    }
  }
  for (const l of lines) {
    log.dim(l);
  }
  console.log();
}

async function interactivePicker(state: ProjectState, cwd: string): Promise<void> {
  const { scope } = await ask<'scope'>({
    type: 'select',
    name: 'scope',
    message: 'Pro co nastavujeme model?',
    choices: MODEL_SCOPES.map((s) => ({ title: SCOPE_LABELS[s], value: s })),
  });
  await interactiveModelForScope(state, scope as ModelScope, cwd);
}

async function interactiveModelForScope(state: ProjectState, scope: ModelScope, cwd: string): Promise<void> {
  const { choice } = await ask<'choice'>({
    type: 'select',
    name: 'choice',
    message: `Model pro "${scope}":`,
    choices: [
      { title: scope === 'default' ? 'Default — necháváno na Claude Code' : `Zděděno (smazat ${scope} override)`, value: '_unset' },
      ...PRESETS.map((p) => ({ title: `${capitalize(p.alias)} — ${p.hint}`, value: p.alias })),
      { title: 'Vlastní — zadáš celé ID modelu', value: '_custom' },
    ],
  });

  if (choice === '_unset') {
    unsetScope(state, scope);
    await save(state, cwd);
    log.success(`${scope}: zděděno z default / Claude Code.`);
    return;
  }

  let newModel: string;
  if (choice === '_custom') {
    const { id } = await ask<'id'>({
      type: 'text',
      name: 'id',
      message: 'ID modelu (např. claude-sonnet-4-6):',
      format: trim,
      validate: nonEmpty('ID modelu nesmí být prázdné.'),
    });
    newModel = id as string;
  } else {
    newModel = choice as string;
  }

  setScopeRaw(state, scope, newModel);
  await save(state, cwd);
  log.success(`${scope}: ${newModel}`);
}

async function setScope(state: ProjectState, scope: ModelScope, value: string, cwd: string): Promise<void> {
  const v = value.trim();
  if (v === 'default' || v === '_default' || v === 'unset') {
    unsetScope(state, scope);
    await save(state, cwd);
    log.success(`${scope}: zděděno z default / Claude Code.`);
    return;
  }
  setScopeRaw(state, scope, v);
  await save(state, cwd);
  log.success(`${scope}: ${v}`);
}

function setScopeRaw(state: ProjectState, scope: ModelScope, value: string): void {
  if (!state.models) {
    state.models = {};
  }
  state.models[scope] = value;
  if (scope === 'default') {
    delete state.model;
  }
}

function unsetScope(state: ProjectState, scope: ModelScope): void {
  if (state.models) {
    delete state.models[scope];
    if (Object.keys(state.models).length === 0) {
      delete state.models;
    }
  }
  if (scope === 'default') {
    delete state.model;
  }
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}
