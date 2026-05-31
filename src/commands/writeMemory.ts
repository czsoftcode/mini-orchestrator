import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { askClaude } from '../claude/ask.js';
import {
  buildWriteMemoryPrompt,
  LAST_MEMORY_FILE,
  MEMORY_DIR,
} from '../prompts/writeMemory.js';
import { phaseStem, readProject } from '../state/store.js';
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

// Názvy „velkých" sekcí memory koláže. Sdílené mezi producentem
// (`buildPhaseMemoryMarkdown`) a konzumentem (`summarizeMemoryForNext`), aby se
// kotvy nikdy nerozešly — kdo přejmenuje sekci, změní obojí na jednom místě.
const DISCUSS_SECTION = 'Diskuse';
const RUN_REPORT_SECTION = 'Run report';

/**
 * Zapíše memory soubor pro hotovou fázi do `.mini/memory/phase-XXX.md`
 * a uloží jeho krátké shrnutí do `.mini/last-memory.md` (vstup promptu `next`).
 *
 * Název nese jen padded ID fáze (`phaseStem`) — žádné datum. Když soubor téže
 * fáze už existuje (opakované `done`), připojí se číselný rozlišovač
 * (`phase-XXX-2.md`, `-3`, …), aby se historie nepřepsala (viz `freeMemoryPath`).
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
  const memoryDirAbs = join(cwd, MEMORY_DIR);

  try {
    await mkdir(memoryDirAbs, { recursive: true });
  } catch (err) {
    log.warn(`Memory pro fázi ${phase.id} se nepodařilo zapsat: nemohu vytvořit ${MEMORY_DIR} (${(err as Error).message}).`);
    return;
  }

  const memoryFileName = await freeMemoryFileName(memoryDirAbs, phase.id);
  const memoryPathRel = join(MEMORY_DIR, memoryFileName);
  const memoryPathAbs = join(cwd, memoryPathRel);

  const discussPath = join(DISCUSS_DIR_REL, `${phaseStem(phase.id)}.md`);
  const runReportPath = join(RUN_DIR_REL, `${phaseStem(phase.id)}.md`);

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

  await writeLastMemorySummary(cwd, memoryPathAbs, memoryPathRel);
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
    // Memory soubor je součástí commitu fáze, takže jeho vlastní sha tady znát
    // nemůžeme (závisel by sám na sobě). Legacy fáze sha ještě mají — když je,
    // ukážeme ho; jinak vystačíme se subjectem commitu.
    const ref = phase.autoCommit.sha ? ` (\`${phase.autoCommit.sha}\`)` : '';
    parts.push(`- ${phase.autoCommit.subject}${ref}`);
  }

  if (discussContent.trim()) {
    parts.push('');
    parts.push(`## ${DISCUSS_SECTION}`);
    parts.push(discussContent.trim());
  }

  if (runContent.trim()) {
    parts.push('');
    parts.push(`## ${RUN_REPORT_SECTION}`);
    parts.push(runContent.trim());
  }

  return `${parts.join('\n')}\n`;
}

/** Horní mez délky shrnutí (znaky). Pojistka, aby ani neznámý formát paměti
 * (např. claude-mode, kde memory píše volně Claude) prompt `next` nenafoukl. */
const SUMMARY_MAX_CHARS = 2000;

/** Vzory nadpisů „na co dát pozor" v run reportu — ten má názvy sekcí volné
 * (píše je Claude), tak je matchujeme sadou slov místo fixní kotvy. Prompty jsou
 * anglicky (od fáze 76), ale starší česká paměť se taky musí pochytit. */
const RUN_WATCH_RE = /pozor|nález|další fáz|watch out|finding|next phase/i;

/**
 * Z plné memory koláže (`buildPhaseMemoryMarkdown`) vyrobí krátké shrnutí pro
 * prompt `next`. Ponechá hlavu (hlavička, cíl, kroky, poznámka, auto-commit) a
 * navíc vytáhne to nejcennější pro návrh další fáze: pod-sekci `## Pozor na`
 * z bloku Diskuse a sekci „nález / další fáze" z bloku Run report. Doslovný
 * Záměr, Klíčová rozhodnutí a mechanické kroky/ověření vynechá.
 *
 * Slicuje podle literálních kotev `## Diskuse` / `## Run report`, které vyrábí
 * producent výš — proto NEjde naivně splitovat podle `## ` (Diskuse i Run report
 * mají vlastní vnořené `##` nadpisy na stejné úrovni). Když kotvy chybí (paměť
 * v neznámém formátu), vrátí aspoň tvrdě omezenou délku.
 */
export function summarizeMemoryForNext(md: string): string {
  const text = md.trimEnd();

  const discussIdx = indexOfSection(text, DISCUSS_SECTION, 0);
  const runSearchFrom = discussIdx === -1 ? 0 : discussIdx + 1;
  const runIdx = indexOfSection(text, RUN_REPORT_SECTION, runSearchFrom);

  // Bez známých kotev neumíme strukturně ořezat — vrátíme aspoň pojistku délkou.
  if (discussIdx === -1 && runIdx === -1) {
    return hardCap(text);
  }

  // Hlava = vše před první kotvou (hlavička, cíl, kroky, poznámka, auto-commit).
  const headEnd = Math.min(
    discussIdx === -1 ? text.length : discussIdx,
    runIdx === -1 ? text.length : runIdx,
  );
  const parts: string[] = [text.slice(0, headEnd).trimEnd()];

  if (discussIdx !== -1) {
    const discussEnd = runIdx > discussIdx ? runIdx : text.length;
    const pozor = extractSubsection(text.slice(discussIdx, discussEnd), (h) => /pozor|watch out/i.test(h));
    if (pozor) parts.push(pozor);
  }

  if (runIdx !== -1) {
    const nalez = extractSubsection(text.slice(runIdx), (h) => RUN_WATCH_RE.test(h));
    if (nalez) parts.push(nalez);
  }

  // Ve strukturní větvi NEkrátíme tvrdě délkou — to by uřízlo konec, tj. zrovna
  // vytažené „Pozor na" / „Nález" (nejcennější část). Hranicí je výběr sekcí.
  return `${parts.join('\n\n').trimEnd()}\n`;
}

/** Najde začátek řádku `## <name>` od `fromIndex`. Vrací index `#`, nebo -1. */
function indexOfSection(text: string, name: string, fromIndex: number): number {
  const heading = `## ${name}`;
  if (fromIndex === 0 && text.startsWith(heading)) return 0;
  const idx = text.indexOf(`\n${heading}`, fromIndex);
  return idx === -1 ? -1 : idx + 1;
}

/**
 * V bloku najde první pod-sekci `## <nadpis>`, jejíž nadpis splní `matches`, a
 * vrátí ji od nadpisu po další `## ` (nebo konec bloku). `null`, když nic nesedí.
 */
function extractSubsection(block: string, matches: (heading: string) => boolean): string | null {
  const lines = block.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^## (.+)$/.exec(lines[i] ?? '');
    if (m && m[1] && matches(m[1])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i] ?? '')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trimEnd();
}

/** Omezí text na `SUMMARY_MAX_CHARS` (řez na hranici řádku) a normalizuje konec.
 * Používá se jen ve fallbacku bez kotev — ve strukturní větvi by uřízlo to nejcennější. */
function hardCap(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed.length <= SUMMARY_MAX_CHARS) {
    return `${trimmed}\n`;
  }
  const slice = trimmed.slice(0, SUMMARY_MAX_CHARS);
  const cut = slice.lastIndexOf('\n');
  const body = (cut > 0 ? slice.slice(0, cut) : slice).trimEnd();
  return `${body}\n\n…(zkráceno)\n`;
}

/**
 * Spustí Claude print-mode session, která zapíše memory soubor. Volá se jen
 * v explicitním režimu (`state.models?.memory != null`). Vrací `true`, když
 * soubor vznikl (a má smysl z něj zapsat shrnutí do last-memory.md).
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
 * Zapíše `.mini/last-memory.md` jako **krátké shrnutí** nejnovější fáze. Přečte
 * právě zapsaný archivní soubor (plnou koláž), prožene ho `summarizeMemoryForNext`
 * a výsledek uloží — `last-memory.md` tak není kopií archivu, ale jeho zeštíhlenou
 * verzí, kterou pak `next` vkládá do promptu (proto je čte JEN `next`).
 *
 * Funguje jednotně pro TS i claude-mode větev: vstupem je hotový soubor na disku.
 * Archiv `.mini/memory/phase-XXX.md` zůstává plný a netknutý.
 *
 * Selhání = jen `log.dim` — last-memory.md je čistě pro pohodlí, archiv už je
 * na disku.
 */
async function writeLastMemorySummary(cwd: string, memoryPathAbs: string, memoryPathRel: string): Promise<void> {
  const lastMemoryAbs = join(cwd, LAST_MEMORY_FILE);

  // Starý last-memory.md může být ještě symlink z dřívějška — smazat před zápisem.
  try {
    await unlink(lastMemoryAbs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.dim(`(starý ${LAST_MEMORY_FILE} se nepodařilo smazat: ${(err as Error).message})`);
    }
  }

  try {
    const full = await readFile(memoryPathAbs, 'utf-8');
    await writeFile(lastMemoryAbs, summarizeMemoryForNext(full), 'utf-8');
    log.dim(`  ${LAST_MEMORY_FILE} (shrnutí ${memoryPathRel})`);
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
 * Najde volný název memory souboru pro fázi v `dirAbs`. Výchozí je `phase-XXX.md`
 * (padded ID, bez data); když už existuje (opakované `done` téže fáze), zkouší
 * `phase-XXX-2.md`, `phase-XXX-3.md`, … dokud nenarazí na volný — historie se
 * tak nikdy nepřepíše. Vrací jen název souboru (ne cestu).
 */
export async function freeMemoryFileName(dirAbs: string, phaseId: number): Promise<string> {
  const stem = phaseStem(phaseId);
  const base = `${stem}.md`;
  if (!(await fileExists(join(dirAbs, base)))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}.md`;
    if (!(await fileExists(join(dirAbs, candidate)))) return candidate;
  }
}
