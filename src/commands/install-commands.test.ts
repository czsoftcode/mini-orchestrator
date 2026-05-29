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
  it('vygeneruje pět .md commandů pro pět příkazů cyklu', async () => {
    await installCommands(cwd);
    const files = (await readdir(join(cwd, COMMANDS_DIR))).sort();
    expect(files).toEqual(['discuss.md', 'do.md', 'done.md', 'next.md', 'plan.md']);
  });

  it('každý command volá mini context <name>', async () => {
    await installCommands(cwd);
    for (const name of ['next', 'discuss', 'plan', 'do', 'done']) {
      const md = await readFile(join(cwd, COMMANDS_DIR, `${name}.md`), 'utf-8');
      expect(md).toContain(`mini context ${name}`);
      expect(md).toContain('description:');
    }
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
      ['next', 'discuss', 'plan', 'do', 'done'].map((n) => readFile(join(cwd, COMMANDS_DIR, `${n}.md`), 'utf-8')),
    );
    await installCommands(cwd);
    const after = await Promise.all(
      ['next', 'discuss', 'plan', 'do', 'done'].map((n) => readFile(join(cwd, COMMANDS_DIR, `${n}.md`), 'utf-8')),
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
