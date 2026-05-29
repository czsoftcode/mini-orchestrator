import { access, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Adresář pro reporty z auto session.
 *
 * Po dokončení fáze v auto módu sem Claude zapisuje strojově čitelný report
 * (`phase-{id}.md`) se statusy kroků a verdiktem fáze. `done({ auto: true })`
 * tenhle soubor čte a podle něj posune stav v `state.json`. Reporty zůstávají
 * po finalizaci fáze jako historie — analogicky k `.mini/discuss/`.
 */
export const RUN_DIR = join('.mini', 'run');

/**
 * Statusy kroků v reportu — vlastní enum oddělený od `StepStatus` ve stavu:
 *
 * - `done` — krok je hotový (mapuje se na `StepStatus.done`),
 * - `skipped` — Claude ho vědomě vynechal (mapuje se na `StepStatus.skipped`),
 * - `blocked` — Claude na něm narazil na blocker, který sám neumí obejít,
 * - `todo` — krok zbývá udělat (nevyšel čas, retry to zkusí znovu).
 *
 * `blocked` a `todo` se nemapují přímo na `StepStatus` — `done({ auto })` je
 * interpretuje jako "krok není uzavřený" a buď spustí retry, nebo se zeptá člověka.
 */
export type RunStepStatus = 'done' | 'skipped' | 'blocked' | 'todo';

/**
 * Verdikt celé fáze:
 *
 * - `done` — všechny kroky hotové (nebo vědomě skipnuté), fáze splnila cíl,
 * - `partial` — něco zbývá, ale Clauda nic neblokovalo (typicky vyšel `maxTurns`),
 * - `blocked` — narazil na blocker, který sám neumí obejít.
 */
export type RunVerdict = 'done' | 'partial' | 'blocked';

export interface RunReportStep {
  /** Doslova musí odpovídat `Step.title` ve `state.json`. */
  title: string;
  status: RunStepStatus;
}

/**
 * Jeden bod k ručnímu ověření — věc, kterou Claude sám nedokázal ověřit
 * (typicky vizuální UI, UX flow, subjektivní dojem). `mini done` je při
 * uzavírání fáze projde s člověkem (pass/skip/issue/block).
 */
export interface RunReportVerifyItem {
  /** Co má člověk ověřit (povinné). */
  title: string;
  /** Volitelný kontext — co a jak Claude (ne)ověřil. */
  detail?: string;
}

export interface RunReport {
  /** ID fáze, ke které report patří. Musí sedět s aktuální `currentPhaseId`. */
  phase: number;
  verdict: RunVerdict;
  steps: RunReportStep[];
  /**
   * Body k ručnímu ověření. Volitelné pole — chybějící `verify` = prázdný
   * seznam (zpětná kompatibilita se staršími reporty, workflow se nemění).
   */
  verify: RunReportVerifyItem[];
  /** Volný text pod YAML blokem (poznámky pro člověka). Bez YAML hlavičky. */
  body?: string;
}

export function runReportPath(cwd: string, phaseId: number): string {
  return join(cwd, RUN_DIR, `phase-${phaseId}.md`);
}

/**
 * Cesta k zálohovanému předchozímu reportu (`phase-{id}.prev.md`).
 *
 * Auto loop sem před druhým a třetím pokusem přejmenuje aktuální
 * `phase-{id}.md`, aby si ho Claude mohl přečíst pro kontext, aniž by ho nový
 * report při zápisu okamžitě přepsal.
 */
export function previousRunReportPath(cwd: string, phaseId: number): string {
  return join(cwd, RUN_DIR, `phase-${phaseId}.prev.md`);
}

/**
 * Vytvoří `.mini/run/` adresář (rekurzivně, idempotentně).
 *
 * Voláme to z `doPhase({ auto })` ještě před spuštěním Claude session, aby měl
 * Claude kam zapsat report bez kolize.
 */
export async function ensureRunDir(cwd: string): Promise<void> {
  await mkdir(join(cwd, RUN_DIR), { recursive: true });
}

export async function runReportExists(cwd: string, phaseId: number): Promise<boolean> {
  try {
    await access(runReportPath(cwd, phaseId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Chyba parseru reportu. Vyhozená vždy, když report nelze bezpečně použít
 * k posunu stavu (chybí YAML, neplatná hodnota, neznámý/chybějící krok…).
 * Caller (`done({ auto })`) ji zachytí a spadne do interaktivního fallbacku.
 */
export class RunReportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RunReportParseError';
  }
}

const ALLOWED_VERDICTS: readonly RunVerdict[] = ['done', 'partial', 'blocked'];
const ALLOWED_STEP_STATUSES: readonly RunStepStatus[] = ['done', 'skipped', 'blocked', 'todo'];

export interface ParseRunReportContext {
  /** Očekávané ID fáze — report musí sedět, jinak hrozí, že posuneme špatnou fázi. */
  expectedPhaseId: number;
  /**
   * Doslovné názvy kroků aktuální fáze ze `state.json`. Parser ověří, že každý
   * krok v reportu sedí na nějaký očekávaný, a že žádný očekávaný krok nechybí.
   * Strict match (case + whitespace) — jediná spolehlivá cesta, jak namapovat
   * Claudův výstup na konkrétní položku ve stavu bez fuzzy hádání.
   */
  expectedStepTitles: readonly string[];
}

/**
 * Parsuje `.mini/run/phase-{id}.md` (YAML front matter + volný text) a zároveň
 * ověří integritu vůči stavu fáze. Při jakékoli odchylce hází `RunReportParseError`.
 */
export function parseRunReport(text: string, ctx: ParseRunReportContext): RunReport {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  const match = /^---\s*\n([\s\S]*?)\n---[ \t]*(?:\n([\s\S]*))?$/.exec(normalized);
  if (!match) {
    throw new RunReportParseError(
      'Report neobsahuje YAML front matter ohraničený řádky "---". Bez něj nelze strojově posunout stav.',
    );
  }

  const yamlText = match[1] ?? '';
  const rawBody = match[2];
  const body = rawBody && rawBody.trim().length > 0 ? rawBody.replace(/^\n+/, '').replace(/\s+$/, '') : undefined;

  const data = parseSimpleYaml(yamlText);

  const phaseRaw = data.phase;
  if (typeof phaseRaw !== 'number' || !Number.isInteger(phaseRaw)) {
    throw new RunReportParseError(
      `Pole "phase" musí být celé číslo (je: ${formatValue(phaseRaw)}).`,
    );
  }
  if (phaseRaw !== ctx.expectedPhaseId) {
    throw new RunReportParseError(
      `Report patří fázi ${phaseRaw}, ale aktuální fáze je ${ctx.expectedPhaseId}.`,
    );
  }

  const verdictRaw = data.verdict;
  if (typeof verdictRaw !== 'string' || !isVerdict(verdictRaw)) {
    throw new RunReportParseError(
      `Pole "verdict" musí být jedno z ${ALLOWED_VERDICTS.join(' / ')} (je: ${formatValue(verdictRaw)}).`,
    );
  }

  const stepsRaw = data.steps;
  if (!Array.isArray(stepsRaw)) {
    throw new RunReportParseError(
      `Pole "steps" musí být seznam (je: ${formatValue(stepsRaw)}).`,
    );
  }

  const steps: RunReportStep[] = [];
  for (let i = 0; i < stepsRaw.length; i++) {
    const item = stepsRaw[i];
    if (!isObject(item)) {
      throw new RunReportParseError(
        `steps[${i}] musí být objekt s poli "title" a "status" (je: ${formatValue(item)}).`,
      );
    }
    const title = item.title;
    const status = item.status;
    if (typeof title !== 'string' || title.length === 0) {
      throw new RunReportParseError(
        `steps[${i}].title musí být neprázdný řetězec (je: ${formatValue(title)}).`,
      );
    }
    if (typeof status !== 'string' || !isStepStatus(status)) {
      throw new RunReportParseError(
        `steps[${i}].status u kroku "${title}" musí být jedno z ${ALLOWED_STEP_STATUSES.join(' / ')} (je: ${formatValue(status)}).`,
      );
    }
    steps.push({ title, status });
  }

  const reportedTitles = steps.map((s) => s.title);
  const reportedSet = new Set(reportedTitles);
  if (reportedSet.size !== reportedTitles.length) {
    const dups = duplicates(reportedTitles);
    throw new RunReportParseError(
      `Report obsahuje duplicitní názvy kroků: ${dups.map(quote).join(', ')}.`,
    );
  }

  const expectedSet = new Set(ctx.expectedStepTitles);
  const unknown = reportedTitles.filter((t) => !expectedSet.has(t));
  if (unknown.length > 0) {
    throw new RunReportParseError(
      `Report uvádí kroky, které neexistují ve stavu fáze: ${unknown.map(quote).join(', ')}.`,
    );
  }

  const missing = ctx.expectedStepTitles.filter((t) => !reportedSet.has(t));
  if (missing.length > 0) {
    throw new RunReportParseError(
      `Report neuvádí status pro některé kroky fáze: ${missing.map(quote).join(', ')}.`,
    );
  }

  const verify = parseVerify(data.verify);

  return { phase: phaseRaw, verdict: verdictRaw, steps, verify, body };
}

/**
 * Naparsuje volitelné pole `verify`. Chybějící/`null` = prázdný seznam
 * (zpětná kompatibilita). Každá položka musí mít neprázdný `title`; `detail`
 * je volitelný řetězec. Cokoli jiného je chyba — radši zařveme, než abychom
 * tiše ztratili bod k ověření.
 */
function parseVerify(raw: unknown): RunReportVerifyItem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new RunReportParseError(
      `Pole "verify" musí být seznam (je: ${formatValue(raw)}).`,
    );
  }
  const items: RunReportVerifyItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isObject(item)) {
      throw new RunReportParseError(
        `verify[${i}] musí být objekt s polem "title" (je: ${formatValue(item)}).`,
      );
    }
    const title = item.title;
    if (typeof title !== 'string' || title.length === 0) {
      throw new RunReportParseError(
        `verify[${i}].title musí být neprázdný řetězec (je: ${formatValue(title)}).`,
      );
    }
    const detailRaw = item.detail;
    let detail: string | undefined;
    if (detailRaw === undefined || detailRaw === null) {
      detail = undefined;
    } else if (typeof detailRaw === 'string') {
      detail = detailRaw.length > 0 ? detailRaw : undefined;
    } else {
      throw new RunReportParseError(
        `verify[${i}].detail u bodu "${title}" musí být řetězec (je: ${formatValue(detailRaw)}).`,
      );
    }
    items.push(detail !== undefined ? { title, detail } : { title });
  }
  return items;
}

/**
 * Pohodlný wrapper: přečte soubor reportu z disku a naparsuje ho.
 * Pro "soubor neexistuje" vrátí `null` — vyšší vrstva tak rozliší
 * chybějící report (interaktivní fallback) od poškozeného (přetéci výjimku).
 */
export async function readRunReport(
  cwd: string,
  ctx: ParseRunReportContext,
): Promise<RunReport | null> {
  const path = runReportPath(cwd, ctx.expectedPhaseId);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  return parseRunReport(raw, ctx);
}

/**
 * Lehký, tolerantní souhrn reportu pro `mini status`. Na rozdíl od
 * `parseRunReport` nevaliduje kroky vůči stavu a nehází — když report nejde
 * naparsovat, vrátí `unparseable: true`. Status totiž jen informuje, nesmí
 * spadnout kvůli zastaralému nebo poškozenému reportu.
 */
export interface RunReportSummary {
  /** Verdikt z reportu, nebo `null` když chybí/je neplatný. */
  verdict: RunVerdict | null;
  /** Body k ručnímu ověření (tolerantně; při chybě prázdné). */
  verify: RunReportVerifyItem[];
  /** `true`, když report existuje, ale nejde naparsovat (chybí YAML apod.). */
  unparseable: boolean;
}

/**
 * Vytáhne z textu reportu jen verdikt a verify body — bez tvrdé validace kroků.
 * Určeno výhradně pro zobrazení v `mini status`.
 */
export function summarizeRunReportText(text: string): RunReportSummary {
  try {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const match = /^---\s*\n([\s\S]*?)\n---[ \t]*(?:\n[\s\S]*)?$/.exec(normalized);
    if (!match) {
      return { verdict: null, verify: [], unparseable: true };
    }
    const data = parseSimpleYaml(match[1] ?? '');
    const verdict =
      typeof data.verdict === 'string' && isVerdict(data.verdict) ? data.verdict : null;
    let verify: RunReportVerifyItem[];
    try {
      verify = parseVerify(data.verify);
    } catch {
      verify = [];
    }
    return { verdict, verify, unparseable: false };
  } catch {
    return { verdict: null, verify: [], unparseable: true };
  }
}

/**
 * Přečte `.mini/run/phase-{id}.md` a vrátí jeho tolerantní souhrn, nebo `null`
 * když report neexistuje. Pro `mini status` — nikdy nehází kvůli obsahu reportu.
 */
export async function readRunReportSummary(
  cwd: string,
  phaseId: number,
): Promise<RunReportSummary | null> {
  const path = runReportPath(cwd, phaseId);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
  return summarizeRunReportText(raw);
}

// --- minimální YAML parser pro náš omezený formát ---------------------------
// Plnotučnou YAML knihovnu nepotřebujeme: report má pevnou strukturu
// (top-level skaláry `phase`/`verdict` a seznam map `steps` se dvěma poli).
// Záměrně podporujeme přesně tolik, kolik je v promptu vzorováno, aby parser
// nebyl širší než kontrakt — neznámé konstrukty raději zařvou, než aby se
// tiše zinterpretovaly špatně.

interface YamlLine {
  /** Index ve zdrojovém textu (0-based) — pro hlášky uživateli +1. */
  sourceLine: number;
  /** Počet úvodních mezer (jiný whitespace záměrně netolerujeme — tab by rozhodil indenty). */
  indent: number;
  /** Obsah za odsazením; bez komentáře a bez koncových mezer. */
  content: string;
}

function parseSimpleYaml(text: string): Record<string, unknown> {
  const allLines = text.split('\n');
  const lines: YamlLine[] = [];
  for (let i = 0; i < allLines.length; i++) {
    const raw = allLines[i] ?? '';
    if (/\t/.test(raw)) {
      throw new RunReportParseError(
        `YAML obsahuje tabulátor na řádku ${i + 1} — použij mezery (YAML nepovoluje taby v odsazení).`,
      );
    }
    const noComment = stripComment(raw);
    const trimmedRight = noComment.replace(/[ \t]+$/, '');
    if (trimmedRight.trim() === '') continue;
    const firstNonSpace = trimmedRight.search(/\S/);
    const indent = firstNonSpace === -1 ? 0 : firstNonSpace;
    lines.push({ sourceLine: i, indent, content: trimmedRight.slice(indent) });
  }

  const state = { pos: 0 };
  const result = parseMap(state, lines, -1);
  if (state.pos < lines.length) {
    const stuck = lines[state.pos]!;
    throw new RunReportParseError(
      `Neočekávaný obsah YAML na řádku ${stuck.sourceLine + 1}: ${JSON.stringify(allLines[stuck.sourceLine] ?? '')}.`,
    );
  }
  return result;
}

function parseMap(
  state: { pos: number },
  lines: YamlLine[],
  parentIndent: number,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  let mapIndent = -1;
  while (state.pos < lines.length) {
    const line = lines[state.pos]!;
    if (line.indent <= parentIndent) break;
    if (mapIndent === -1) mapIndent = line.indent;
    if (line.indent !== mapIndent) {
      throw new RunReportParseError(
        `Nečekané odsazení na řádku ${line.sourceLine + 1} (čekal jsem ${mapIndent} mezer, je jich ${line.indent}).`,
      );
    }
    const kv = matchKeyValue(line.content);
    if (!kv) {
      throw new RunReportParseError(
        `Nečitelná řádka YAML (řádek ${line.sourceLine + 1}): ${JSON.stringify(line.content)}.`,
      );
    }
    state.pos++;
    if (kv.rest === '') {
      const next = lines[state.pos];
      if (!next || next.indent <= line.indent) {
        obj[kv.key] = null;
        continue;
      }
      if (next.content.startsWith('- ') || next.content === '-' || next.content === '[]') {
        obj[kv.key] = parseList(state, lines, line.indent);
      } else {
        obj[kv.key] = parseMap(state, lines, line.indent);
      }
    } else {
      obj[kv.key] = parseScalar(kv.rest, line.sourceLine);
    }
  }
  return obj;
}

function parseList(
  state: { pos: number },
  lines: YamlLine[],
  parentIndent: number,
): unknown[] {
  const arr: unknown[] = [];
  let listIndent = -1;
  while (state.pos < lines.length) {
    const line = lines[state.pos]!;
    if (line.indent <= parentIndent) break;
    if (listIndent === -1) listIndent = line.indent;

    if (line.content === '[]') {
      if (arr.length > 0) {
        throw new RunReportParseError(
          `Seznam má prázdný marker "[]" na řádku ${line.sourceLine + 1}, ale zároveň obsahuje položky.`,
        );
      }
      state.pos++;
      return arr;
    }

    if (line.indent !== listIndent) break;

    if (!line.content.startsWith('-')) {
      throw new RunReportParseError(
        `Očekávána položka seznamu začínající "-" na řádku ${line.sourceLine + 1}: ${JSON.stringify(line.content)}.`,
      );
    }

    const afterDash = line.content.slice(1);
    if (afterDash.length > 0 && !afterDash.startsWith(' ')) {
      throw new RunReportParseError(
        `Za pomlčkou na řádku ${line.sourceLine + 1} chybí mezera.`,
      );
    }
    const itemContent = afterDash.replace(/^ +/, '');
    const itemColumnInLine = line.indent + 1 + (afterDash.length - itemContent.length);

    const kv = matchKeyValue(itemContent);
    if (kv) {
      const item: Record<string, unknown> = {};
      item[kv.key] = kv.rest === '' ? null : parseScalar(kv.rest, line.sourceLine);
      state.pos++;
      while (state.pos < lines.length) {
        const sub = lines[state.pos]!;
        if (sub.indent <= line.indent) break;
        if (sub.indent !== itemColumnInLine) {
          throw new RunReportParseError(
            `Nečekané odsazení uvnitř položky seznamu na řádku ${sub.sourceLine + 1} (čekáno ${itemColumnInLine} mezer, je ${sub.indent}).`,
          );
        }
        const subKv = matchKeyValue(sub.content);
        if (!subKv) {
          throw new RunReportParseError(
            `Nečitelná řádka YAML uvnitř položky seznamu (řádek ${sub.sourceLine + 1}): ${JSON.stringify(sub.content)}.`,
          );
        }
        item[subKv.key] = subKv.rest === '' ? null : parseScalar(subKv.rest, sub.sourceLine);
        state.pos++;
      }
      arr.push(item);
    } else {
      arr.push(parseScalar(itemContent, line.sourceLine));
      state.pos++;
    }
  }
  return arr;
}

function matchKeyValue(content: string): { key: string; rest: string } | null {
  const m = /^([A-Za-z_][A-Za-z0-9_-]*)[ \t]*:(?:[ \t]+(.*))?$/.exec(content);
  if (!m) return null;
  return { key: m[1]!, rest: (m[2] ?? '').trim() };
}

function parseScalar(value: string, sourceLine: number): unknown {
  const v = value.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === '[]') return [];
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return unquoteDouble(v.slice(1, -1), sourceLine);
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function unquoteDouble(inner: string, sourceLine: number): string {
  let out = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '\\') {
      const next = inner[i + 1];
      if (next === undefined) {
        throw new RunReportParseError(
          `Neukončený escape na konci řetězce (řádek ${sourceLine + 1}).`,
        );
      }
      if (next === 'n') out += '\n';
      else if (next === 't') out += '\t';
      else if (next === 'r') out += '\r';
      else if (next === '"' || next === '\\' || next === '/') out += next;
      else {
        throw new RunReportParseError(
          `Neznámý escape "\\${next}" v řetězci (řádek ${sourceLine + 1}).`,
        );
      }
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

function stripComment(line: string): string {
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuote === '"') {
      if (ch === '\\') { i++; continue; }
      if (ch === '"') { inQuote = null; }
      continue;
    }
    if (inQuote === "'") {
      if (ch === "'") { inQuote = null; }
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; continue; }
    if (ch === '#') {
      const prev = line[i - 1];
      if (i === 0 || prev === ' ' || prev === '\t') {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVerdict(value: string): value is RunVerdict {
  return (ALLOWED_VERDICTS as readonly string[]).includes(value);
}

function isStepStatus(value: string): value is RunStepStatus {
  return (ALLOWED_STEP_STATUSES as readonly string[]).includes(value);
}

function duplicates<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const dups = new Set<T>();
  for (const v of values) {
    if (seen.has(v)) dups.add(v);
    else seen.add(v);
  }
  return [...dups];
}

function quote(s: string): string {
  return `"${s}"`;
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
