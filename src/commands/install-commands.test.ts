import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COMMANDS_DIR, installCommands } from './install-commands.js';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-install-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('installCommands', () => {
  it('generates .md commands for init, the five cycle commands, auto and the read-only status and map', async () => {
    await installCommands(cwd);
    const files = (await readdir(join(cwd, COMMANDS_DIR))).sort();
    expect(files).toEqual([
      'audit.md',
      'auto.md',
      'changelog.md',
      'discuss.md',
      'do.md',
      'done.md',
      'init.md',
      'map.md',
      'model.md',
      'next.md',
      'plan.md',
      'status.md',
      'todo.md',
      'undo.md',
      'upgrade.md',
      'verify.md',
    ]);
  });

  it('the todo command calls mini todo, not mini context, and offers the suggest action', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'todo.md'), 'utf-8');
    expect(md).toContain('mini todo');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
    expect(md).toContain('suggest');
  });

  it('the upgrade command is non-interactive: --check preview then --yes apply', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'upgrade.md'), 'utf-8');
    expect(md).toContain('mini upgrade --check');
    expect(md).toContain('mini upgrade --yes');
    // It must never fall back to the blocking interactive form.
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('the undo command is non-interactive: --dry-run preview then --yes apply', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'undo.md'), 'utf-8');
    expect(md).toContain('mini undo --dry-run');
    expect(md).toContain('mini undo --yes');
    // It must never fall back to the blocking interactive form.
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('the model command uses the non-interactive subcommands, not mini context', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'model.md'), 'utf-8');
    expect(md).toContain('mini model show');
    expect(md).toContain('mini model reset');
    expect(md).toContain('$ARGUMENTS');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('the verify command calls mini context verify and describes the UI/UX review', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'verify.md'), 'utf-8');
    expect(md).toContain('mini context verify');
    expect(md).toContain('description:');
    expect(md).toContain('UI/UX');
  });

  it('the audit command calls mini audit, not mini context', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'audit.md'), 'utf-8');
    expect(md).toContain('mini audit');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('the init command creates a project via mini init --apply and offers /mini:map and /mini:audit', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'init.md'), 'utf-8');
    expect(md).toContain('mini init --apply');
    expect(md).not.toContain('mini context');
    expect(md).toContain('/mini:map');
    expect(md).toContain('/mini:audit');
    expect(md).toContain('description:');
  });

  it('every workflow command calls mini context <name>', async () => {
    await installCommands(cwd);
    for (const name of ['next', 'discuss', 'plan', 'do', 'done']) {
      const md = await readFile(join(cwd, COMMANDS_DIR, `${name}.md`), 'utf-8');
      expect(md).toContain(`mini context ${name}`);
      expect(md).toContain('description:');
    }
  });

  it('the status command calls mini status, not mini context', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'status.md'), 'utf-8');
    expect(md).toContain('mini status');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('the map command calls mini map, not mini context', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'map.md'), 'utf-8');
    expect(md).toContain('mini map');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('the auto command describes the autonomous loop next→discuss→plan→do→verify→done with a condition on discuss', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'auto.md'), 'utf-8');
    // all cycle steps as mini context calls (including next and verify)
    for (const name of ['next', 'discuss', 'plan', 'do', 'verify', 'done']) {
      expect(md).toContain(`mini context ${name}`);
    }
    // discuss is conditional, not unconditional
    expect(md).toMatch(/condition|only when|only if/i);
    // done is saved via mini done --apply (bump/push are opt-in via run arguments)
    expect(md).toContain('mini done --apply');
    expect(md).toContain('description:');
  });

  it('the auto command forwards --bump and --push to the done step', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'auto.md'), 'utf-8');
    // exposed as run arguments
    expect(md).toContain('--bump');
    expect(md).toContain('--push');
    // appended to the final done save
    expect(md).toContain('mini done --apply [--bump <level>] [--push]');
    // --push requires an explicit bump (same constraint as mini done)
    expect(md).toMatch(/--push.*requires|requires.*--bump/i);
  });

  it('the auto command is autonomous: argument-hint, --max-phases (default 1), --yolo and a loop over multiple phases', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'auto.md'), 'utf-8');
    // run arguments from $ARGUMENTS
    expect(md).toContain('argument-hint:');
    expect(md).toContain('$ARGUMENTS');
    expect(md).toContain('--max-phases');
    expect(md).toContain('--yolo');
    expect(md).toContain('--verify');
    expect(md).toContain('--discuss');
    // default 1 phase when --max-phases is missing
    expect(md).toMatch(/default 1|default.*1/i);
    // an autonomous run over multiple phases (not just one phase)
    expect(md).toMatch(/autonom/i);
    // quiet run — no edit listings
    expect(md).toMatch(/edit listing|don't print|do not print/i);
    // detection of a finished project
    expect(md).toContain('TITLE: -');
  });

  it('the auto command inserts verify between do and done: conditionally for UI/UX and forced via --verify', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'auto.md'), 'utf-8');
    // verify is in the cycle as a mini context call and the --verify flag forces it
    expect(md).toContain('mini context verify');
    expect(md).toContain('--verify');
    // the step is described as UI/UX and conditional (skipped for an internal phase)
    expect(md).toMatch(/UI\/UX/);
    expect(md).toMatch(/skip/i);
    // verify precedes done in the cycle text
    expect(md.indexOf('mini context verify')).toBeLessThan(md.indexOf('mini context done'));
  });

  it('the auto command can force discuss via --discuss', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'auto.md'), 'utf-8');
    // the --discuss flag forces discuss in every phase (otherwise conditional)
    expect(md).toContain('--discuss');
    // the discuss step stays conditional when --discuss is absent
    expect(md).toMatch(/discuss/i);
    expect(md).toMatch(/skip/i);
  });

  it('the auto command describes the stop hooks (checkpoints + mini stop)', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'auto.md'), 'utf-8');
    // the stop flag file + the command the user creates it with + both checkpoint granularities
    expect(md).toContain('.mini/STOP');
    expect(md).toMatch(/mini stop/);
    expect(md).toMatch(/between cycle steps/i);
    expect(md).toMatch(/step-done/);
  });

  it('the do command first starts the phase (mini do --apply), then context do, step-done and the report', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'do.md'), 'utf-8');
    expect(md).toContain('mini do --apply');
    expect(md).toContain('mini context do');
    expect(md).toContain('mini do --apply --step-done');
    expect(md).toContain('.mini/run/');
    // the init (`mini do --apply`) must precede printing the prompt (`mini context do`)
    expect(md.indexOf('mini do --apply')).toBeLessThan(md.indexOf('mini context do'));
  });

  it('the next command passes $ARGUMENTS as the idea', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'next.md'), 'utf-8');
    expect(md).toContain('mini context next $ARGUMENTS');
    expect(md).toContain('argument-hint:');
  });

  it('is idempotent — the second run does not change the content', async () => {
    await installCommands(cwd);
    const before = await Promise.all(
      ['init', 'next', 'discuss', 'plan', 'do', 'done', 'status', 'map', 'audit', 'auto'].map((n) => readFile(join(cwd, COMMANDS_DIR, `${n}.md`), 'utf-8')),
    );
    await installCommands(cwd);
    const after = await Promise.all(
      ['init', 'next', 'discuss', 'plan', 'do', 'done', 'status', 'map', 'audit', 'auto'].map((n) => readFile(join(cwd, COMMANDS_DIR, `${n}.md`), 'utf-8')),
    );
    expect(after).toEqual(before);
  });

  it('overwrites the stale content of an existing command', async () => {
    await mkdir(join(cwd, COMMANDS_DIR), { recursive: true });
    await writeFile(join(cwd, COMMANDS_DIR, 'next.md'), 'old body', 'utf-8');
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'next.md'), 'utf-8');
    expect(md).not.toBe('old body');
    expect(md).toContain('mini context next');
  });
});
