import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMANDS_DIR } from './commands.js';
import { installSlashCommands, resolveTarget, userCommandsDir } from './install.js';

// Non-interactive by default (no TTY) — installSlashCommands then uses the
// detected default scope without prompting, which is what these tests rely on.
vi.mock('../ui/interactive.js', () => ({ isInteractive: () => false }));

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'mini-install-scope-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('resolveTarget', () => {
  it('resolves the project scope under cwd/.claude/commands/mini', () => {
    const t = resolveTarget('project', '/proj');
    expect(t.scope).toBe('project');
    expect(t.dir).toBe(join('/proj', COMMANDS_DIR));
    expect(t.displayDir).toBe(COMMANDS_DIR);
  });

  it('resolves the user scope under the home directory', () => {
    const t = resolveTarget('user', '/proj');
    expect(t.scope).toBe('user');
    expect(t.dir).toBe(userCommandsDir());
    expect(t.dir.startsWith(homedir())).toBe(true);
    expect(t.displayDir).toBe(join('~', COMMANDS_DIR));
  });
});

describe('installSlashCommands', () => {
  it('writes the commands into the project when scope=project', async () => {
    const res = await installSlashCommands({ cwd, scope: 'project' });
    expect(res.target.scope).toBe('project');
    const files = await readdir(join(cwd, COMMANDS_DIR));
    expect(files).toContain('next.md');
    expect(files).toContain('import-gsd.md');
    expect(files).toContain('decision.md');
    expect(files).toContain('adversarial.md');
    expect(files).toContain('adversarial-project.md');
    expect(files.length).toBe(22);
  });

  it('dry-run writes nothing', async () => {
    const res = await installSlashCommands({ cwd, scope: 'project', dryRun: true });
    expect(res.created).toBeGreaterThan(0);
    await expect(readdir(join(cwd, COMMANDS_DIR))).rejects.toThrow();
  });

  it('without a scope and without a TTY, falls back to the detected default (project for local-only)', async () => {
    const res = await installSlashCommands({
      cwd,
      detection: { installed: true, global: false, local: true },
    });
    expect(res.target.scope).toBe('project');
    const files = await readdir(join(cwd, COMMANDS_DIR));
    expect(files).toContain('do.md');
  });
});
