import { access, copyFile, mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { askClaude } from '../claude/ask.js';
import {
  buildWriteMemoryPrompt,
  LAST_MEMORY_FILE,
  MEMORY_DIR,
} from '../prompts/writeMemory.js';
import { readProject } from '../state/store.js';
import type { Phase, ProjectState, StepStatus } from '../state/types.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';

// Živé konstanty explicitního memory režimu — používá je `writeViaClaude`,
// když je scope `memory` ručně nastaven přes `mini model`. NEJSOU mrtvý kód:
// krok z fáze 17 „smazat MEMORY_ALLOWED_TOOLS / MEMORY_TIMEOUT_MS / import
// buildWriteMemoryPrompt" byl proto vědomě skipnut. Nemaž je.
const MEMORY_ALLOWED_TOOLS = ['Read', 'Bash', 'Write'];
const MEMORY_TIMEOUT_MS = 5 * 60 * 1000;

const DISCUSS_DIR_REL = join('.mini', 'discuss');
const RUN_DIR_REL = join('.mini', 'run');

const STEP_WORD: Record<StepStatus, string> = {
  done: 'hotovo',
  doing: 'dělá se',
  todo: 'čeká',
  skipped: 'odloženo',
};

/**
 * Zapíše memory soubor pro hotovou fázi do `.mini/memory/phase-{id}-{timestamp}.md`
 * a aktualizuje symlink `.mini/last-memory.md` na nejnovější záznam.
 *
 * Ve výchozím stavu sestaví soubor **přímo v TypeScriptu** jako koláž dat, která
 * mini už má (metadata fáze + doslovný obsah discuss a run reportu) — bez volání
 * Claude API. Výstup je delší a syrovější než claudovská syntéza, ale zadarmo a
 * okamžitý.
 *
 * Claude se zavolá **pouze** když je model scope `memory` explicitně nastaven
 * (`state.models?.memory != null`) — ne když se jen dědí z `default`.
 *
 * Memory je **nice-to-have** — nikdy nehází. Když zápis selže, vypíše se jen
 * warning a workflow pokračuje (fáze už je `done` v state.json a auto-commit
 * už proběhl).
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

  // Explicitní Claude režim — jen když je `memory` scope ručně nastaven přes
  // `mini model`. Fallback na default model k volání Claude NESTAČÍ.
  if (state.models?.memory != null) {
    const ok = await writeViaClaude(phase, state, cwd, {
      memoryPathRel,
      memoryPathAbs,
      discussPath,
      runReportPath,
      hasAutoCommit: options.hasAutoCommit,
    });
    if (!ok) return;
  } else {
    const [discussContent, runContent] = await Promise.all([
      readFileOrEmpty(join(cwd, discussPath)),
      readFileOrEmpty(join(cwd, runReportPath)),
    ]);

    const markdown = buildPhaseMemoryMarkdown(phase, discussContent, runContent);

    try {
      await writeFile(memoryPathAbs, markdown, 'utf-8');
    } catch (err) {
      log.warn(`Memory pro fázi ${phase.id} se nepodařilo zapsat: ${(err as Error).message}`);
      log.hint('Pokračuji bez memory záznamu.');
      return;
    }

    log.success(`Memory: ${memoryPathRel}`);
  }

  await updateLastMemoryLink(cwd, memoryPathAbs, memoryPathRel);
}

/**
 * Sestaví obsah memory souboru přímo z dat fáze a doslovně vloženého obsahu
 * discuss a run reportu. Žádná syntéza — jen poskládání toho, co mini má.
 */
export function buildPhaseMemoryMarkdown(
  phase: Phase,
  discussContent: string,
  runContent: string,
): string {
  const parts: string[] = [];

  parts.push(`# Fáze ${phase.id} — ${phase.title}`);
  parts.push('');
  parts.push(`**Cíl:** ${phase.goal?.trim() || '(nezadán)'}`);

  if (phase.steps?.length) {
    parts.push('');
    parts.push('## Kroky');
    parts.push(phase.steps.map((s) => `- [${STEP_WORD[s.status]}] ${s.title}`).join('\n'));
  }

  if (phase.humanNotes?.trim()) {
    parts.push('');
    parts.push('## Poznámka uživatele');
    parts.push(phase.humanNotes.trim());
  }

  if (phase.autoCommit) {
    parts.push('');
    parts.push('## Auto-commit');
    parts.push(`- ${phase.autoCommit.subject} (\`${phase.autoCommit.sha}\`)`);
  }

  if (discussContent.trim()) {
    parts.push('');
    parts.push('## Diskuse');
    parts.push(discussContent.trim());
  }

  if (runContent.trim()) {
    parts.push('');
    parts.push('## Run report');
    parts.push(runContent.trim());
  }

  return `${parts.join('\n')}\n`;
}

/**
 * Spustí Claude print-mode session, která zapíše memory soubor. Volá se jen
 * v explicitním režimu (`state.models?.memory != null`). Vrací `true`, když
 * soubor vznikl (a má smysl aktualizovat last-memory symlink).
 */
async function writeViaClaude(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  ctx: {
    memoryPathRel: string;
    memoryPathAbs: string;
    discussPath: string;
    runReportPath: string;
    hasAutoCommit: boolean;
  },
): Promise<boolean> {
  const [discussExists, runExists, projectMd] = await Promise.all([
    fileExists(join(cwd, ctx.discussPath)),
    fileExists(join(cwd, ctx.runReportPath)),
    readProject(cwd).catch(() => ''),
  ]);

  const prompt = buildWriteMemoryPrompt({
    projectMd,
    phase,
    memoryPath: ctx.memoryPathRel,
    discussPath: discussExists ? ctx.discussPath : undefined,
    runReportPath: runExists ? ctx.runReportPath : undefined,
    hasAutoCommit: ctx.hasAutoCommit,
  });

  log.dim(`Zapisuji memory pro fázi ${phase.id} přes Claude do ${ctx.memoryPathRel}…`);

  let response;
  try {
    response = await askClaude(prompt, {
      cwd,
      allowedTools: MEMORY_ALLOWED_TOOLS,
      permissionMode: 'acceptEdits',
      timeoutMs: MEMORY_TIMEOUT_MS,
      model: state.models?.memory,
    });
  } catch (err) {
    log.warn(`Memory pro fázi ${phase.id} se nepodařilo zapsat: ${(err as Error).message}`);
    log.hint('Pokračuji bez memory záznamu.');
    return false;
  }

  logUsage(response);

  if (!(await fileExists(ctx.memoryPathAbs))) {
    log.warn(`Memory pro fázi ${phase.id} se nepodařilo zapsat: Claude soubor ${ctx.memoryPathRel} nevytvořil.`);
    return false;
  }

  log.success(`Memory: ${ctx.memoryPathRel}`);
  return true;
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

/** Přečte soubor jako string; když neexistuje (nebo selže čtení), vrátí prázdný string. */
async function readFileOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * ISO 8601 timestamp s `-` místo `:` — `:` je nepovolený znak v názvech souborů
 * na Windows. Příklad: `2026-05-24T14-30-00.000Z`.
 */
export function fsSafeTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-');
}
