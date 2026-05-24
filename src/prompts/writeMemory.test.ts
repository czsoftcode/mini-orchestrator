import { describe, expect, it } from 'vitest';
import { buildWriteMemoryPrompt, LAST_MEMORY_FILE, MEMORY_DIR } from './writeMemory.js';
import type { Phase } from '../state/types.js';

const PROJECT_MD = `# Můj projekt
Stavím nástroj X pro Y.`;

const MEMORY_PATH = `${MEMORY_DIR}/phase-7-2026-05-24T14-30-00Z.md`;

describe('buildWriteMemoryPrompt', () => {
  it('renders phase with steps, humanNotes a git context', () => {
    const phase: Phase = {
      id: 7,
      title: 'Záznam paměti',
      goal: 'po fázi se zapíše memory soubor',
      status: 'done',
      steps: [
        { title: 'prompt builder', status: 'done' },
        { title: 'symlink', status: 'done' },
      ],
      humanNotes: 'Symlink se na Windows fallbackuje na copyFile.',
    };

    const out = buildWriteMemoryPrompt({
      projectMd: PROJECT_MD,
      phase,
      memoryPath: MEMORY_PATH,
      discussPath: '.mini/discuss/phase-7.md',
      runReportPath: '.mini/run/phase-7.md',
      hasAutoCommit: true,
    });

    expect(out).toContain('**Fáze 7: Záznam paměti**');
    expect(out).toContain('Cíl: po fázi se zapíše memory soubor');
    expect(out).toContain('- [hotovo] prompt builder');
    expect(out).toContain('Symlink se na Windows fallbackuje na copyFile.');
    expect(out).toContain('git show HEAD');
    expect(out).toContain('.mini/discuss/phase-7.md');
    expect(out).toContain('.mini/run/phase-7.md');
    expect(out).toContain(MEMORY_PATH);
    expect(out).toContain('NEIMPLEMENTUJ');
    expect(out).toMatchSnapshot();
  });

  it('vyjadřuje, ať Claude nepouští git show, když auto-commit neproběhl', () => {
    const phase: Phase = {
      id: 2,
      title: 'Bez gitu',
      goal: 'něco se udělalo bez commitu',
      status: 'done',
    };

    const out = buildWriteMemoryPrompt({
      projectMd: PROJECT_MD,
      phase,
      memoryPath: MEMORY_PATH,
      hasAutoCommit: false,
    });

    expect(out).toContain('`git show HEAD` **nepouštěj**');
    expect(out).not.toContain('Bash');
    expect(out).not.toContain('Kroky:');
    expect(out).not.toContain('Poznámka uživatele');
    expect(out).toMatchSnapshot();
  });

  it('vynechá discuss/run odkazy, když soubory neexistují', () => {
    const phase: Phase = {
      id: 3,
      title: 'Bez kontextu',
      status: 'done',
      steps: [{ title: 'jediný krok', status: 'done' }],
    };

    const out = buildWriteMemoryPrompt({
      projectMd: PROJECT_MD,
      phase,
      memoryPath: MEMORY_PATH,
      hasAutoCommit: true,
    });

    expect(out).not.toContain('.mini/discuss/');
    expect(out).not.toContain('.mini/run/');
    expect(out).toContain('- [hotovo] jediný krok');
    expect(out).toContain('Cíl: (nezadán)');
  });

  it('trims projectMd whitespace', () => {
    const phase: Phase = { id: 1, title: 'P1', status: 'done' };
    const out = buildWriteMemoryPrompt({
      projectMd: `\n\n  ${PROJECT_MD}  \n\n`,
      phase,
      memoryPath: MEMORY_PATH,
      hasAutoCommit: false,
    });

    expect(out).toContain(`# Projekt\n${PROJECT_MD}\n`);
    expect(out).not.toContain('# Projekt\n\n');
  });

  it('exportuje konstanty cest', () => {
    expect(MEMORY_DIR).toBe('.mini/memory');
    expect(LAST_MEMORY_FILE).toBe('.mini/last-memory.md');
  });
});
