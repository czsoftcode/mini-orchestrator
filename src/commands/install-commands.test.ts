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
  it('vygeneruje .md commandy pro init, pět příkazů cyklu, auto i read-only status a map', async () => {
    await installCommands(cwd);
    const files = (await readdir(join(cwd, COMMANDS_DIR))).sort();
    expect(files).toEqual([
      'audit.md',
      'auto.md',
      'discuss.md',
      'do.md',
      'done.md',
      'init.md',
      'map.md',
      'next.md',
      'plan.md',
      'status.md',
    ]);
  });

  it('audit command volá mini audit, ne mini context', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'audit.md'), 'utf-8');
    expect(md).toContain('mini audit');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('init command zakládá projekt přes mini init --apply a nabízí /mini:map a /mini:audit', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'init.md'), 'utf-8');
    expect(md).toContain('mini init --apply');
    expect(md).not.toContain('mini context');
    expect(md).toContain('/mini:map');
    expect(md).toContain('/mini:audit');
    expect(md).toContain('description:');
  });

  it('každý workflow command volá mini context <name>', async () => {
    await installCommands(cwd);
    for (const name of ['next', 'discuss', 'plan', 'do', 'done']) {
      const md = await readFile(join(cwd, COMMANDS_DIR, `${name}.md`), 'utf-8');
      expect(md).toContain(`mini context ${name}`);
      expect(md).toContain('description:');
    }
  });

  it('status command volá mini status, ne mini context', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'status.md'), 'utf-8');
    expect(md).toContain('mini status');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('map command volá mini map, ne mini context', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'map.md'), 'utf-8');
    expect(md).toContain('mini map');
    expect(md).not.toContain('mini context');
    expect(md).toContain('description:');
  });

  it('auto command popisuje sekvenci discuss→plan→do→done s podmínkou na discuss', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'auto.md'), 'utf-8');
    // všechny čtyři kroky cyklu jako mini context volání
    for (const name of ['discuss', 'plan', 'do', 'done']) {
      expect(md).toContain(`mini context ${name}`);
    }
    // discuss je podmíněný, ne bezpodmínečný
    expect(md).toMatch(/podmín|jen když|pouze/i);
    // done se ukládá bez automatického push na remote
    expect(md).toContain('mini done --apply');
    expect(md).not.toContain('mini done --apply --push');
    expect(md).toContain('description:');
  });

  it('do command nejdřív nastartuje fázi (mini do --apply), pak context do, step-done a report', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'do.md'), 'utf-8');
    expect(md).toContain('mini do --apply');
    expect(md).toContain('mini context do');
    expect(md).toContain('mini do --apply --step-done');
    expect(md).toContain('.mini/run/');
    // init (`mini do --apply`) musí předcházet vypsání promptu (`mini context do`)
    expect(md.indexOf('mini do --apply')).toBeLessThan(md.indexOf('mini context do'));
  });

  it('next command předává $ARGUMENTS jako nápad', async () => {
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'next.md'), 'utf-8');
    expect(md).toContain('mini context next $ARGUMENTS');
    expect(md).toContain('argument-hint:');
  });

  it('je idempotentní — druhé spuštění obsah nezmění', async () => {
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

  it('přepíše zastaralý obsah existujícího commandu', async () => {
    await mkdir(join(cwd, COMMANDS_DIR), { recursive: true });
    await writeFile(join(cwd, COMMANDS_DIR, 'next.md'), 'staré tělo', 'utf-8');
    await installCommands(cwd);
    const md = await readFile(join(cwd, COMMANDS_DIR, 'next.md'), 'utf-8');
    expect(md).not.toBe('staré tělo');
    expect(md).toContain('mini context next');
  });
});
