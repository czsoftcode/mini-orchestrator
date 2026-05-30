import type {
  ExportInfo,
  FileGraph,
  FunctionSignature,
  ImportInfo,
  MethodSignature,
  Parameter,
} from './types.js';

/**
 * Regex-based Python mapper. Na rozdíl od TS/PHP/Rust nestojí na `{}`, ale na
 * **odsazení**: top-level = sloupec 0, konec bloku (`endLine`) se hledá podle
 * úrovně odsazení následujících řádků. Nejdřív se smažou komentáře (`#`) a
 * stringy (vč. triple-quoted docstringů a prefixů `r/f/b/rb/...`) nahrazením
 * mezerami stejné délky se zachováním `\n`, aby řádky/pozice i počítání závorek
 * zůstaly věrné originálu — jinak by docstring s `def`/`class`/`#` vyrobil
 * falešné exporty.
 *
 * Konzervativní záměrně: "export" = top-level `def`/`async def`/`class` nebo
 * UPPER_CASE/anotovaná konstanta, jejíž jméno nezačíná `_` (konvence místo
 * `__all__`). U tříd se sbírají veřejné metody. Importy jen modulové (sloupec 0).
 */
export function mapPythonFile(content: string, relPath: string): FileGraph {
  const stripped = stripPythonCommentsAndStrings(content);
  const lines = buildLines(stripped);
  const imports = extractImports(lines);
  const exports = extractExports(stripped, lines);
  return {
    path: relPath.replace(/\\/g, '/'),
    exports,
    imports,
  };
}

// ---------------------------------------------------------------------------
// Stripping komentářů a stringů
// ---------------------------------------------------------------------------

const SINGLE_PREFIX = new Set(['r', 'b', 'u', 'f']);
const DOUBLE_PREFIX = new Set(['rb', 'br', 'rf', 'fr']);

interface StringStart {
  quote: string;
  triple: boolean;
  prefixLen: number;
}

/**
 * Pokud na pozici `i` začíná řetězec (případně s prefixem `r/b/u/f`/`rb`/...),
 * vrátí jeho parametry, jinak `null`. Prefix se uzná jen tehdy, když mu
 * nepředchází znak identifikátoru (jinak by `arb"x"` falešně chytlo `rb"x"`).
 */
function matchStringStart(content: string, i: number): StringStart | null {
  const c = content[i];
  if (c === undefined) return null;
  if (c === '"' || c === "'") {
    const triple = content[i + 1] === c && content[i + 2] === c;
    return { quote: c, triple, prefixLen: 0 };
  }
  if (!/[rbufRBUF]/.test(c)) return null;
  const prev = content[i - 1];
  if (prev !== undefined && /[A-Za-z0-9_]/.test(prev)) return null;
  // dvouznakový prefix
  const two = (c + (content[i + 1] ?? '')).toLowerCase();
  if (DOUBLE_PREFIX.has(two)) {
    const q = content[i + 2];
    if (q === '"' || q === "'") {
      const triple = content[i + 3] === q && content[i + 4] === q;
      return { quote: q, triple, prefixLen: 2 };
    }
  }
  // jednoznakový prefix
  if (SINGLE_PREFIX.has(c.toLowerCase())) {
    const q = content[i + 1];
    if (q === '"' || q === "'") {
      const triple = content[i + 2] === q && content[i + 3] === q;
      return { quote: q, triple, prefixLen: 1 };
    }
  }
  return null;
}

function stripPythonCommentsAndStrings(content: string): string {
  const out: string[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === undefined) break;

    // # řádkový komentář (Python nemá blokové komentáře)
    if (c === '#') {
      while (i < n && content[i] !== '\n') {
        out.push(' ');
        i++;
      }
      continue;
    }

    const s = matchStringStart(content, i);
    if (s) {
      // prefix necháme být (neškodná písmena), uvozovky i tělo → mezery
      for (let k = 0; k < s.prefixLen; k++) out.push(content[i + k] ?? ' ');
      let j = i + s.prefixLen;
      const qlen = s.triple ? 3 : 1;
      for (let k = 0; k < qlen; k++) out.push(' ');
      j += qlen;
      while (j < n) {
        const d = content[j];
        if (d === '\\' && j + 1 < n) {
          out.push(content[j] === '\n' ? '\n' : ' ');
          out.push(content[j + 1] === '\n' ? '\n' : ' ');
          j += 2;
          continue;
        }
        if (d === s.quote) {
          if (s.triple) {
            if (content[j + 1] === s.quote && content[j + 2] === s.quote) {
              out.push(' ');
              out.push(' ');
              out.push(' ');
              j += 3;
              break;
            }
            out.push(' ');
            j++;
            continue;
          }
          out.push(' ');
          j++;
          break;
        }
        out.push(d === '\n' ? '\n' : ' ');
        j++;
      }
      i = j;
      continue;
    }

    out.push(c);
    i++;
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// Řádky a odsazení
// ---------------------------------------------------------------------------

interface LineMeta {
  /** 1-based číslo řádku (index v poli je `lineNo - 1`). */
  lineNo: number;
  /** Očištěný text řádku bez koncového `\n`. */
  text: string;
  /** Šířka odsazení (mezera = 1, tab = doplnění do násobku 8). */
  indent: number;
  /** True pro prázdný / pouze-komentářový (po strippingu prázdný) řádek. */
  blank: boolean;
  /** Absolutní offset začátku řádku v očištěném textu. */
  start: number;
  /** Absolutní offset prvního neprázdného znaku (u prázdného = `start`). */
  contentStart: number;
}

function indentWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (ch === ' ') w++;
    else if (ch === '\t') w += 8 - (w % 8);
    else break;
  }
  return w;
}

function buildLines(content: string): LineMeta[] {
  const lines: LineMeta[] = [];
  const raw = content.split('\n');
  let start = 0;
  let lineNo = 1;
  for (const text of raw) {
    const trimmedLen = text.length - text.trimStart().length;
    lines.push({
      lineNo,
      text,
      indent: indentWidth(text),
      blank: text.trim() === '',
      start,
      contentStart: start + trimmedLen,
    });
    start += text.length + 1; // + '\n'
    lineNo++;
  }
  return lines;
}

/** Číslo řádku (1-based), na kterém leží znak na dané pozici. */
function lineAt(text: string, position: number): number {
  let line = 1;
  const stop = Math.min(position, text.length);
  for (let i = 0; i < stop; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function bracketDelta(text: string): number {
  let d = 0;
  for (const ch of text) {
    if (ch === '(' || ch === '[' || ch === '{') d++;
    else if (ch === ')' || ch === ']' || ch === '}') d--;
  }
  return d;
}

function endsWithBackslash(text: string): boolean {
  return text.replace(/\s+$/, '').endsWith('\\');
}

function matchParen(content: string, openPos: number): number {
  let depth = 0;
  for (let i = openPos; i < content.length; i++) {
    if (content[i] === '(') depth++;
    else if (content[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return content.length;
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Rozsah bloku (suite) podle odsazení
// ---------------------------------------------------------------------------

interface SuiteRange {
  /** Řádek s dvojtečkou (`:`) zavádějící suite. */
  colonLineNo: number;
  /** Poslední řádek bloku (best-effort). */
  endLine: number;
  /** True, když je tělo na stejném řádku (`def f(): return 1`). */
  inline: boolean;
}

/**
 * Najde rozsah suite hlavičky začínající na `lines[startIdx]`. Hlavička může jít
 * přes víc fyzických řádků (parametry v závorkách) — dvojtečku hledáme na
 * závorkové hloubce 0. `endLine` = poslední neprázdný řádek odsazený víc než
 * `headerIndent`.
 */
function suiteRange(content: string, lines: LineMeta[], startIdx: number, headerIndent: number): SuiteRange {
  const startAbs = lines[startIdx]!.contentStart;
  let depth = 0;
  let colonPos = -1;
  for (let i = startAbs; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ':' && depth === 0) {
      colonPos = i;
      break;
    }
  }
  if (colonPos === -1) {
    const lineNo = lines[startIdx]!.lineNo;
    return { colonLineNo: lineNo, endLine: lineNo, inline: true };
  }
  const colonLineNo = lineAt(content, colonPos);
  let rest = '';
  for (let k = colonPos + 1; k < content.length && content[k] !== '\n'; k++) {
    rest += content[k];
  }
  if (rest.trim().length > 0) {
    return { colonLineNo, endLine: colonLineNo, inline: true };
  }
  let endLine = colonLineNo;
  for (let idx = colonLineNo; idx < lines.length; idx++) {
    const ln = lines[idx]!;
    if (ln.blank) continue;
    if (ln.indent > headerIndent) endLine = ln.lineNo;
    else break;
  }
  return { colonLineNo, endLine, inline: false };
}

/** Poslední fyzický řádek logického příkazu (přes závorky / backslash). */
function statementEndLine(lines: LineMeta[], startIdx: number): number {
  let depth = 0;
  let endLineNo = lines[startIdx]!.lineNo;
  for (let idx = startIdx; idx < lines.length; idx++) {
    const ln = lines[idx]!;
    endLineNo = ln.lineNo;
    depth += bracketDelta(ln.text);
    const bs = endsWithBackslash(ln.text);
    if (depth <= 0 && !bs) break;
  }
  return endLineNo;
}

// ---------------------------------------------------------------------------
// Importy
// ---------------------------------------------------------------------------

function extractImports(lines: LineMeta[]): ImportInfo[] {
  const imports: ImportInfo[] = [];
  let depth = 0;
  let prevBackslash = false;
  for (let idx = 0; idx < lines.length; idx++) {
    const ln = lines[idx]!;
    const statementStart = depth === 0 && !prevBackslash;
    if (statementStart && !ln.blank && ln.indent === 0) {
      const trimmed = ln.text.trimStart();
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        parseImportStatement(gatherLogical(lines, idx), imports);
      }
    }
    depth += bracketDelta(ln.text);
    prevBackslash = endsWithBackslash(ln.text);
  }
  return imports;
}

/** Spojí logický příkaz přes víc fyzických řádků (závorky / backslash) do jednoho. */
function gatherLogical(lines: LineMeta[], startIdx: number): string {
  const parts: string[] = [];
  let depth = 0;
  for (let idx = startIdx; idx < lines.length; idx++) {
    const ln = lines[idx]!;
    parts.push(ln.text.replace(/\\\s*$/, ' '));
    depth += bracketDelta(ln.text);
    if (depth <= 0 && !endsWithBackslash(ln.text)) break;
  }
  return parts.join(' ');
}

function lastSegment(dotted: string): string {
  const segs = dotted.split('.').filter(Boolean);
  return segs[segs.length - 1] ?? dotted;
}

function parseImportStatement(text: string, out: ImportInfo[]): void {
  const stmt = text.trim();
  if (stmt.startsWith('import ')) {
    const body = stmt.slice('import '.length);
    for (const part of splitTopLevelCommas(body)) {
      const asM = /^(.+?)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(part);
      if (asM && asM[1] !== undefined && asM[2] !== undefined) {
        out.push({ source: asM[1].trim(), symbols: [asM[2]] });
      } else {
        const source = part.trim();
        out.push({ source, symbols: [lastSegment(source)] });
      }
    }
    return;
  }
  // from <mod> import <...>
  const m = /^from\s+(\.*[\w.]*)\s+import\s+([\s\S]+)$/.exec(stmt);
  if (!m || m[1] === undefined || m[2] === undefined) return;
  const source = m[1];
  let body = m[2].trim();
  if (body.startsWith('(')) body = body.slice(1);
  if (body.endsWith(')')) body = body.slice(0, -1);
  body = body.trim();
  const symbols: string[] = [];
  for (const part of splitTopLevelCommas(body)) {
    if (part === '*') {
      symbols.push('*');
      continue;
    }
    const asM = /^(.+?)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(part);
    if (asM && asM[2] !== undefined) symbols.push(asM[2]);
    else symbols.push(part);
  }
  if (symbols.length > 0) out.push({ source, symbols });
}

// ---------------------------------------------------------------------------
// Exporty
// ---------------------------------------------------------------------------

function isUpperConst(name: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(name) && /[A-Z]/.test(name);
}

function matchConst(trimmed: string): { name: string } | null {
  // anotace: NAME: type  (kvalifikuje vždy — má typ)
  const ann = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[^=]/.exec(trimmed);
  if (ann && ann[1] !== undefined) {
    return ann[1].startsWith('_') ? null : { name: ann[1] };
  }
  // přiřazení: NAME = ...  (jen UPPER_CASE)
  const asg = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(trimmed);
  if (asg && asg[1] !== undefined) {
    const name = asg[1];
    if (!name.startsWith('_') && isUpperConst(name)) return { name };
  }
  return null;
}

function extractExports(content: string, lines: LineMeta[]): ExportInfo[] {
  const exports: ExportInfo[] = [];
  let depth = 0;
  let prevBackslash = false;
  let pendingDecoratorLine: number | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const ln = lines[idx]!;
    const statementStart = depth === 0 && !prevBackslash;
    if (statementStart && !ln.blank && ln.indent === 0) {
      const trimmed = ln.text.trimStart();
      if (trimmed.startsWith('@')) {
        if (pendingDecoratorLine === null) pendingDecoratorLine = ln.lineNo;
      } else {
        const anchorLine = pendingDecoratorLine ?? ln.lineNo;
        const defM = /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(trimmed);
        const classM = /^class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(trimmed);
        if (defM && defM[1] !== undefined) {
          if (!defM[1].startsWith('_')) {
            const openParen = ln.contentStart + (defM[0].length - 1);
            exports.push({
              name: defM[1],
              kind: 'function',
              signature: parsePythonSignature(content, openParen),
              line: anchorLine,
              endLine: suiteRange(content, lines, idx, 0).endLine,
            });
          }
        } else if (classM && classM[1] !== undefined) {
          if (!classM[1].startsWith('_')) {
            const range = suiteRange(content, lines, idx, 0);
            const info: ExportInfo = {
              name: classM[1],
              kind: 'class',
              line: anchorLine,
              endLine: range.endLine,
            };
            const methods = extractMethods(content, lines, range, 0);
            if (methods.length > 0) info.methods = methods;
            exports.push(info);
          }
        } else {
          const c = matchConst(trimmed);
          if (c) {
            exports.push({
              name: c.name,
              kind: 'const',
              line: ln.lineNo,
              endLine: statementEndLine(lines, idx),
            });
          }
        }
        pendingDecoratorLine = null;
      }
    }
    depth += bracketDelta(ln.text);
    prevBackslash = endsWithBackslash(ln.text);
  }
  return exports;
}

/**
 * Vytáhne veřejné metody (def/async def na základní úrovni odsazení těla třídy,
 * jméno bez `_`). `@staticmethod` → `isStatic`. `self`/`cls` se v signatuře
 * vynechají.
 */
function extractMethods(content: string, lines: LineMeta[], classRange: SuiteRange, classIndent: number): MethodSignature[] {
  if (classRange.inline) return [];
  const methods: MethodSignature[] = [];
  let depth = 0;
  let prevBackslash = false;
  let bodyIndent = -1;
  let pendingStatic = false;
  for (let idx = classRange.colonLineNo; idx < lines.length; idx++) {
    const ln = lines[idx]!;
    if (ln.lineNo > classRange.endLine) break;
    const statementStart = depth === 0 && !prevBackslash;
    if (statementStart && !ln.blank) {
      if (bodyIndent === -1 && ln.indent > classIndent) bodyIndent = ln.indent;
      if (ln.indent === bodyIndent) {
        const trimmed = ln.text.trimStart();
        if (trimmed.startsWith('@')) {
          if (/^@\s*staticmethod\b/.test(trimmed)) pendingStatic = true;
        } else {
          const defM = /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(trimmed);
          if (defM && defM[1] !== undefined && !defM[1].startsWith('_')) {
            const openParen = ln.contentStart + (defM[0].length - 1);
            const method: MethodSignature = {
              name: defM[1],
              signature: parsePythonSignature(content, openParen),
            };
            if (pendingStatic) method.isStatic = true;
            methods.push(method);
          }
          pendingStatic = false;
        }
      }
    }
    depth += bracketDelta(ln.text);
    prevBackslash = endsWithBackslash(ln.text);
  }
  return methods;
}

function parsePythonSignature(content: string, openParenPos: number): FunctionSignature {
  const close = matchParen(content, openParenPos);
  const paramsStr = content.slice(openParenPos + 1, close);
  const parameters: Parameter[] = [];
  for (const raw of splitTopLevelCommas(paramsStr)) {
    const part = raw.trim();
    if (!part || part === '/' || part === '*') continue;
    const m = /^(\*{0,2})([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([^=]+?))?\s*(=\s*[\s\S]+)?$/.exec(part);
    if (!m || m[2] === undefined) continue;
    const stars = m[1] ?? '';
    const name = m[2];
    if (stars === '' && (name === 'self' || name === 'cls')) continue;
    const param: Parameter = { name };
    const type = m[3]?.trim();
    if (type) param.type = type;
    if (stars === '*' || stars === '**') param.rest = true;
    if (m[4]) param.optional = true;
    parameters.push(param);
  }
  const sig: FunctionSignature = { parameters };
  // návratový typ -> ... až po dvojtečku na hloubce 0
  let j = close + 1;
  while (j < content.length && /\s/.test(content[j] ?? '')) j++;
  if (content[j] === '-' && content[j + 1] === '>') {
    j += 2;
    let depth = 0;
    let ret = '';
    while (j < content.length) {
      const ch = content[j]!;
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
        ret += ch;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth--;
        ret += ch;
      } else if (ch === ':' && depth === 0) {
        break;
      } else {
        ret += ch === '\n' ? ' ' : ch;
      }
      j++;
    }
    const rt = ret.trim();
    if (rt) sig.returnType = rt;
  }
  return sig;
}
