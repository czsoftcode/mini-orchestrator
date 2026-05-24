import { access, copyFile, mkdir, symlink, unlink } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { askClaude } from '../claude/ask.js';
import {
  buildWriteMemoryPrompt,
  LAST_MEMORY_FILE,
  MEMORY_DIR,
} from '../prompts/writeMemory.js';
import { resolveModel } from '../state/models.js';
import { readProject } from '../state/store.js';
import type { Phase, ProjectState } from '../state/types.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';

const MEMORY_ALLOWED_TOOLS = ['Read', 'Bash', 'Write'];
const MEMORY_TIMEOUT_MS = 5 * 60 * 1000;

const DISCUSS_DIR_REL = join('.mini', 'discuss');
const RUN_DIR_REL = join('.mini', 'run');

/**
 * Spustí Claude print-mode session, která zapíše memory soubor pro hotovou fázi
 * do `.mini/memory/phase-{id}-{timestamp}.md` a aktualizuje symlink
 * `.mini/last-memory.md` na nejnovější záznam.
 *
 * Memory je **nice-to-have** — nikdy nehází. Když session selže nebo Claude
 * soubor nezapíše, vypíše se jen warning a workflow pokračuje (fáze už je
 * `done` v state.json a auto-commit už proběhl).
 *
 * Záměrně **mimo commit** — `commitPhaseWork` proběhl předtím, memory zůstane
 * neverzovaná do dalšího ručního commitu.
 */
export async function writePhaseMemory(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  options: { hasAutoCommit: boolean },
): Promise<void> {
  const timestamp = fsSafeTimestamp(new Date());
  const memoryFileName = `phase-${phase.id}-${timestamp}.md`;
  const memoryPathRel = join(MEMORY_DIR, memoryFileName);
  const memoryPathAbs = join(cwd, memoryPathRel);
  const memoryDirAbs = join(cwd, MEMORY_DIR);

  try {
    await mkdir(memoryDirAbs, { recursive: true });
  } catch (err) {
    log.warn(`Memory pro fázi ${phase.id} se nepodařilo zapsat: nemohu vytvořit ${MEMORY_DIR} (${(err as Error).message}).`);
    return;
  }

  const discussPath = join(DISCUSS_DIR_REL, `phase-${phase.id}.md`);
  const runReportPath = join(RUN_DIR_REL, `phase-${phase.id}.md`);
  const [discussExists, runExists, projectMd] = await Promise.all([
    fileExists(join(cwd, discussPath)),
    fileExists(join(cwd, runReportPath)),
    readProject(cwd).catch(() => ''),
  ]);

  const prompt = buildWriteMemoryPrompt({
    projectMd,
    phase,
    memoryPath: memoryPathRel,
    discussPath: discussExists ? discussPath : undefined,
    runReportPath: runExists ? runReportPath : undefined,
    hasAutoCommit: options.hasAutoCommit,
  });

  log.dim(`Zapisuji memory pro fázi ${phase.id} do ${memoryPathRel}…`);

  let response;
  try {
    response = await askClaude(prompt, {
      cwd,
      allowedTools: MEMORY_ALLOWED_TOOLS,
      permissionMode: 'acceptEdits',
      timeoutMs: MEMORY_TIMEOUT_MS,
      model: resolveModel('memory', state),
    });
  } catch (err) {
    log.warn(`Memory pro fázi ${phase.id} se nepodařilo zapsat: ${(err as Error).message}`);
    log.hint('Pokračuji bez memory záznamu.');
    return;
  }

  logUsage(response);

  if (!(await fileExists(memoryPathAbs))) {
    log.warn(`Memory pro fázi ${phase.id} se nepodařilo zapsat: Claude soubor ${memoryPathRel} nevytvořil.`);
    return;
  }

  log.success(`Memory: ${memoryPathRel}`);

  await updateLastMemoryLink(cwd, memoryPathAbs, memoryPathRel);
}

/**
 * Aktualizuje `.mini/last-memory.md` tak, aby ukazoval na nejnovější memory soubor.
 *
 * Preferuje symlink (lehká reference). Když symlink selže (typicky Windows bez
 * SeCreateSymbolicLink práva), spadne do `copyFile` fallbacku. Před zápisem
 * odstraní starší last-memory.md, ať už je to symlink nebo regulérní soubor.
 *
 * Selhání obou cest = jen `log.dim` — last-memory.md je čistě pro pohodlí,
 * memory soubor sám už je na disku.
 */
async function updateLastMemoryLink(cwd: string, memoryPathAbs: string, memoryPathRel: string): Promise<void> {
  const lastMemoryAbs = join(cwd, LAST_MEMORY_FILE);

  try {
    await unlink(lastMemoryAbs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.dim(`(starý ${LAST_MEMORY_FILE} se nepodařilo smazat: ${(err as Error).message})`);
    }
  }

  // Cíl symlinku držíme relativní k umístění samotného symlinku
  // (oba sedí v `.mini/`), aby přesun/clone projektu fungoval.
  const symlinkTarget = relative(join(cwd, '.mini'), memoryPathAbs);

  try {
    await symlink(symlinkTarget, lastMemoryAbs);
    log.dim(`  ${LAST_MEMORY_FILE} → ${memoryPathRel}`);
    return;
  } catch {
    // Spadneme na copy — typicky Windows bez práv k symlinkům.
  }

  try {
    await copyFile(memoryPathAbs, lastMemoryAbs);
    log.dim(`  ${LAST_MEMORY_FILE} (kopie ${memoryPathRel})`);
  } catch (err) {
    log.dim(`(${LAST_MEMORY_FILE} se nepodařilo aktualizovat: ${(err as Error).message})`);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * ISO 8601 timestamp s `-` místo `:` — `:` je nepovolený znak v názvech souborů
 * na Windows. Příklad: `2026-05-24T14-30-00.000Z`.
 */
export function fsSafeTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-');
}
