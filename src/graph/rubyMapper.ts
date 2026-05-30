import type {
  ExportInfo,
  ExportKind,
  FileGraph,
  FunctionSignature,
  ImportInfo,
  MethodSignature,
  Parameter,
} from './types.js';

/**
 * Regex/scanner-based Ruby mapper. Ruby nemá závorkové bloky — vnoření drží
 * klíčová slova (`class`/`module`/`def`/`if`/`do`/…) párovaná s `end`. Mapper
 * proto pracuje po řádcích (resp. po `;`-oddělených příkazech) nad očištěnou
 * variantou zdroje, kde jsou komentáře (`#`, `=begin`/`=end`) a obsah stringů
 * (`'…'`, `"…"`, `` `…` ``) nahrazené mezerami stejné délky (`\n` se zachovává,
 * aby čísla řádků seděla).
 *
 * Mapuje:
 *  - top-level `def` (jako `function` export se signaturou),
 *  - typy `class` (kind `class`) a `module` (kind `module`) na top-levelu,
 *    jejich viditelné instanční/třídní metody (`def`, `def self.x`) a atributy
 *    (`attr_reader`/`attr_writer`/`attr_accessor`).
 *
 * Default viditelnost v Ruby je `public`; `private`/`protected` (holé přepínače
 * i `private def …`) skryjí následující členy. Vnořené typy a jejich členy se
 * nemapují — model `ExportInfo` pro vnoření slot nemá. Záměrně konzervativní:
 * heredocy, `%w[]`/`%i[]` literály ani `define_method` neřeší.
 */
export function mapRubyFile(content: string, relPath: string): FileGraph {
  const noComments = blankComments(content);
  const imports = extractRubyImports(noComments);
  const stripped = blankStrings(noComments);
  const exports = extractRubyExports(stripped);
  return {
    path: relPath.replace(/\\/g, '/'),
    exports,
    imports,
  };
}

// ---------------------------------------------------------------------------
// Stripping
// ---------------------------------------------------------------------------

/**
 * Smaže komentáře (`#` řádkové i `=begin`/`=end` blokové na začátku řádku),
 * stringy ponechá. `#` uvnitř stringu se nebere jako komentář — proto scan musí
 * znát stav stringu. Nahrazuje mezerami se zachováním `\n`, takže pozice i čísla
 * řádků zůstávají.
 */
function blankComments(content: string): string {
  const out: string[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === undefined) break;
    const atLineStart = i === 0 || content[i - 1] === '\n';

    // blokový komentář =begin ... =end (oba na začátku řádku, sloupec 0)
    if (atLineStart && content.startsWith('=begin', i)) {
      while (i < n) {
        const lineStart = i === 0 || content[i - 1] === '\n';
        if (lineStart && content.startsWith('=end', i)) {
          // přeskoč celý řádek =end
          while (i < n && content[i] !== '\n') {
            out.push(' ');
            i++;
          }
          break;
        }
        out.push(content[i] === '\n' ? '\n' : ' ');
        i++;
      }
      continue;
    }

    // řádkový komentář #
    if (c === '#') {
      while (i < n && content[i] !== '\n') {
        out.push(' ');
        i++;
      }
      continue;
    }

    // stringy se ponechávají, jen je přeskočíme jako celek (kvůli `#` uvnitř)
    if (c === "'" || c === '"' || c === '`') {
      const end = skipString(content, i, c);
      for (let k = i; k < end; k++) {
        const ch = content[k] ?? '';
        out.push(ch === '\n' ? '\n' : ch);
      }
      i = end;
      continue;
    }

    out.push(c);
    i++;
  }
  return out.join('');
}

/**
 * Nad textem bez komentářů vyblankuje obsah stringů (`'…'`, `"…"`, `` `…` ``) na
 * mezery (kvóty taky), `\n` zachová. Tím z očištěného zdroje zmizí klíčová slova
 * schovaná v literálech, ale řádkování sedí.
 */
function blankStrings(content: string): string {
  const out: string[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === undefined) break;
    if (c === "'" || c === '"' || c === '`') {
      const end = skipString(content, i, c);
      for (let k = i; k < end; k++) out.push(content[k] === '\n' ? '\n' : ' ');
      i = end;
      continue;
    }
    out.push(c);
    i++;
  }
  return out.join('');
}

/**
 * Vrátí index za koncem stringu otevřeného na `start` kvótou `quote`. Respektuje
 * escape `\`. Interpolaci `#{…}` v `"…"`/`` `…` `` nezkoumá (bere ji jako součást
 * stringu) — konzervativní, ale pro mapování struktury dostačuje.
 */
function skipString(content: string, start: number, quote: string): number {
  let j = start + 1;
  const n = content.length;
  while (j < n) {
    const ch = content[j];
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === quote) return j + 1;
    j++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Sdílené pomůcky
// ---------------------------------------------------------------------------

/**
 * Rozdělí seznam parametrů podle čárek na top-levelu. Hloubku počítá pro
 * `(` `[` `{`.
 */
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

/** Pozice prvního `=` přiřazení default hodnoty (ne `==`/`<=`/`>=`/`!=`/`=>`). */
function findDefaultEq(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === '=' && depth === 0) {
      const prev = s[i - 1];
      const next = s[i + 1];
      if (prev === '=' || prev === '<' || prev === '>' || prev === '!') continue;
      if (next === '=' || next === '>' || next === '~') continue;
      return i;
    }
  }
  return -1;
}

/** První identifikátor (slovo) na začátku řetězce, nebo `''`. */
function leadingWord(s: string): string {
  const m = /^[A-Za-z_]\w*/.exec(s);
  return m ? m[0] : '';
}

// ---------------------------------------------------------------------------
// Importy
// ---------------------------------------------------------------------------

/**
 * Najde `require '…'` a `require_relative '…'` (volitelně v závorkách). `source`
 * = cesta tak, jak je ve stringu; `symbols` je prázdné (require je side-effect
 * load bez pojmenovaného symbolu).
 */
function extractRubyImports(noComments: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const regex = /(?:^|[^\w.])require(?:_relative)?\s*\(?\s*['"]([^'"\n]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(noComments)) !== null) {
    const source = m[1];
    if (source !== undefined) imports.push({ source, symbols: [] });
  }
  return imports;
}

// ---------------------------------------------------------------------------
// Exporty
// ---------------------------------------------------------------------------

type Visibility = 'public' | 'private' | 'protected';

interface Frame {
  kind: 'class' | 'module' | 'def' | 'block';
  /** True pro `class`/`module`. */
  isType: boolean;
  /** Budovaný export — jen u top-level typu, jinak `undefined`. */
  exp?: ExportInfo;
  /** Posbírané viditelné metody/atributy top-level typu. */
  methods?: MethodSignature[];
  /** Aktuální viditelnost členů (jen u typu). */
  visibility?: Visibility;
  /** Pro top-level `def` export, ať mu na `end` doplníme `endLine`. */
  fnExport?: ExportInfo;
}

const BLOCK_OPENERS = new Set(['if', 'unless', 'while', 'until', 'for', 'case', 'begin']);
const VIS_WORDS = new Set(['private', 'protected', 'public']);
const ATTR_WORDS = new Set(['attr_reader', 'attr_writer', 'attr_accessor']);

/**
 * Projde očištěný zdroj po řádcích (a `;`-oddělených příkazech), drží zásobník
 * `frames` (`class`/`module`/`def`/blok) párovaný s `end` a vytahuje top-level
 * typy + jejich viditelné metody a top-level funkce.
 */
function extractRubyExports(stripped: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const frames: Frame[] = [];
  const lines = stripped.split('\n');

  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1;
    const rawLine = lines[li] ?? '';
    for (const segment of rawLine.split(';')) {
      const stmt = segment.trim();
      if (!stmt) continue;
      li = processStatement(stmt, lineNo, lines, li, frames, exports);
    }
  }

  return exports;
}

/**
 * Zpracuje jeden příkaz. Vrací (případně posunutý) index řádku `li` — `def`
 * s víceřádkovou hlavičkou může spotřebovat další řádky kvůli vyrovnání závorek.
 */
function processStatement(
  stmtRaw: string,
  lineNo: number,
  lines: string[],
  li: number,
  frames: Frame[],
  exports: ExportInfo[],
): number {
  let stmt = stmtRaw;
  let forcedVis: Visibility | undefined;
  let lead = leadingWord(stmt);

  // `private def …` / `protected attr_reader …` — viditelnost na začátku členu
  if (VIS_WORDS.has(lead)) {
    const after = stmt.slice(lead.length).trim();
    const next = leadingWord(after);
    if (next === 'def' || ATTR_WORDS.has(next)) {
      forcedVis = lead as Visibility;
      stmt = after;
      lead = next;
    } else if (after === '') {
      // holý přepínač viditelnosti
      setVisibility(frames, lead as Visibility);
      return li;
    } else {
      // `private :foo` apod. — best-effort neřešíme
      return li;
    }
  }

  // class / module
  if (lead === 'class') {
    if (/^class\s*<</.test(stmt)) {
      // singleton class << self — jen otevírá blok, členy nemapujeme
      frames.push({ kind: 'block', isType: false });
      return li;
    }
    openType(stmt, 'class', lineNo, frames, exports);
    return li;
  }
  if (lead === 'module') {
    openType(stmt, 'module', lineNo, frames, exports);
    return li;
  }

  // def
  if (lead === 'def') {
    return handleDef(stmt, lineNo, lines, li, frames, exports, forcedVis);
  }

  // attr_reader / attr_writer / attr_accessor
  if (ATTR_WORDS.has(lead)) {
    handleAttr(lead, stmt, frames, forcedVis);
    return li;
  }

  // end → zavři nejbližší rámec
  if (lead === 'end') {
    const frame = frames.pop();
    if (frame) closeFrame(frame, lineNo);
    return li;
  }

  // blokové openery (if/unless/while/until/for/case/begin)
  if (BLOCK_OPENERS.has(lead)) {
    // jednořádkový `... end` na stejném příkazu neřešíme (rare)
    frames.push({ kind: 'block', isType: false });
    return li;
  }

  // koncové `do` (blok) — push rámec; `while … do` je už pokryté openerem výše
  if (/\bdo\b\s*(\|[^|\n]*\|)?\s*$/.test(stmt)) {
    frames.push({ kind: 'block', isType: false });
  }

  return li;
}

/** Nastaví viditelnost na nejbližším typovém rámci. */
function setVisibility(frames: Frame[], vis: Visibility): void {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i];
    if (f && f.isType) {
      f.visibility = vis;
      return;
    }
  }
}

/** Nejbližší typový nebo `def` rámec (kvůli umístění metod). */
function nearestScope(frames: Frame[]): Frame | undefined {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i];
    if (f && (f.isType || f.kind === 'def')) return f;
  }
  return undefined;
}

/**
 * Otevře `class`/`module`. Top-level typ (žádný obklopující typ/def) dostane
 * `ExportInfo` a hned se přidá do `exports` (zachová pořadí); `endLine` se doplní
 * na `end`. Vnořený typ jen založí rámec, aby `end` sedělo.
 */
function openType(
  stmt: string,
  keyword: 'class' | 'module',
  lineNo: number,
  frames: Frame[],
  exports: ExportInfo[],
): void {
  const after = stmt.slice(keyword.length).trim();
  const m = /^([A-Z]\w*(?:::[A-Z]\w*)*)/.exec(after);
  const name = m ? m[1]! : '';
  const isTopLevel = !frames.some((f) => f.isType || f.kind === 'def');
  if (name && isTopLevel) {
    const kind: ExportKind = keyword === 'class' ? 'class' : 'module';
    const exp: ExportInfo = { name, kind, line: lineNo };
    const methods: MethodSignature[] = [];
    exports.push(exp);
    frames.push({ kind: keyword, isType: true, exp, methods, visibility: 'public' });
  } else {
    frames.push({ kind: keyword, isType: true, visibility: 'public' });
  }
}

/**
 * Zpracuje `def`. Načte jméno (vč. `self.`/`Konst.` receiveru → třídní metoda),
 * signaturu (závorková i bezzávorková, víceřádkovou hlavičku dočte z dalších
 * řádků) a rozhodne, jestli jde o top-level funkci nebo metodu typu. `endless`
 * metoda (`def x = …`) nezakládá rámec.
 */
function handleDef(
  stmt: string,
  lineNo: number,
  lines: string[],
  li: number,
  frames: Frame[],
  exports: ExportInfo[],
  forcedVis: Visibility | undefined,
): number {
  const after = stmt.slice('def'.length).trim();

  // receiver self. / Konst.
  let rest = after;
  let isStatic = false;
  const recv = /^(self|[A-Z]\w*)\s*\.\s*/.exec(rest);
  if (recv) {
    isStatic = true;
    rest = rest.slice(recv[0].length);
  }

  // jméno metody (vč. `?`/`!`/`=` a operátorů)
  const nameMatch = /^([A-Za-z_]\w*[?!=]?|\[\]=?|<=>|==|!=|<=|>=|<<|>>|[+\-*/%<>~^&|!])/.exec(rest);
  if (!nameMatch) return li;
  const name = nameMatch[1]!;
  let sigPart = rest.slice(name.length);

  // víceřádková hlavička: dočti řádky, dokud se nevyrovnají `(`
  let endLi = li;
  if (sigPart.includes('(')) {
    while (parenBalance(sigPart) > 0 && endLi + 1 < lines.length) {
      endLi++;
      sigPart += '\n' + (lines[endLi] ?? '');
    }
  }

  const signature = parseDefSignature(sigPart);
  const endless = isEndlessDef(sigPart);

  const scope = nearestScope(frames);
  if (!scope) {
    // top-level funkce
    const exp: ExportInfo = { name, kind: 'function', signature, line: lineNo };
    exports.push(exp);
    if (endless) {
      exp.endLine = endLi + 1;
    } else {
      frames.push({ kind: 'def', isType: false, fnExport: exp });
    }
  } else {
    // metoda typu — přidej, jen když je typ top-level a viditelnost public
    if (scope.isType && scope.exp && scope.methods) {
      const vis = forcedVis ?? scope.visibility ?? 'public';
      if (vis === 'public') {
        const method: MethodSignature = { name, signature };
        if (isStatic) method.isStatic = true;
        scope.methods.push(method);
      }
    }
    if (!endless) {
      frames.push({ kind: 'def', isType: false });
    }
  }

  return endLi;
}

/** Součet otevřených `(` minus `)` v řetězci. */
function parenBalance(s: string): number {
  let depth = 0;
  for (const c of s) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
  }
  return depth;
}

/** `def x = …` (endless metoda) — `=` na top-levelu za hlavičkou. */
function isEndlessDef(sigPart: string): boolean {
  let tail = sigPart;
  if (tail.trimStart().startsWith('(')) {
    const close = matchParenStr(tail, tail.indexOf('('));
    tail = tail.slice(close + 1);
  }
  return findDefaultEq(tail) !== -1;
}

/** Index uzavírací `)` k `(` na `open`, nebo konec řetězce. */
function matchParenStr(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return s.length;
}

/**
 * Signatura `def`: závorkový seznam `(…)`, nebo bezzávorkový až do konce
 * hlavičky / `=` (endless). Ruby parametry nemají typy.
 */
function parseDefSignature(sigPart: string): FunctionSignature {
  const trimmed = sigPart.trimStart();
  let paramsStr: string;
  if (trimmed.startsWith('(')) {
    const open = sigPart.indexOf('(');
    const close = matchParenStr(sigPart, open);
    paramsStr = sigPart.slice(open + 1, close);
  } else {
    // bezzávorkové parametry: do konce řádku, bez endless `=`
    let head = sigPart;
    const eq = findDefaultEq(head);
    if (eq !== -1) head = head.slice(0, eq);
    const nl = head.indexOf('\n');
    if (nl !== -1) head = head.slice(0, nl);
    paramsStr = head.trim();
  }
  return { parameters: parseRubyParams(paramsStr) };
}

/**
 * Ruby parametry: `name`, `name = default` (optional), `*rest`/`**opts` (rest),
 * `&block`, keyword `name:` / `name: default` (optional s defaultem). Bez typů.
 */
function parseRubyParams(paramsStr: string): Parameter[] {
  const result: Parameter[] = [];
  for (const segRaw of splitTopLevelCommas(paramsStr)) {
    let seg = segRaw.trim();
    if (!seg) continue;
    let rest = false;
    let optional = false;

    if (seg.startsWith('**')) {
      rest = true;
      seg = seg.slice(2).trim();
    } else if (seg.startsWith('*')) {
      rest = true;
      seg = seg.slice(1).trim();
    } else if (seg.startsWith('&')) {
      seg = seg.slice(1).trim();
    }

    let name: string;
    const kw = /^([A-Za-z_]\w*):(?!:)\s*(.*)$/.exec(seg);
    if (kw) {
      name = kw[1]!;
      if ((kw[2] ?? '').trim() !== '') optional = true;
    } else {
      const eq = findDefaultEq(seg);
      if (eq !== -1) {
        optional = true;
        seg = seg.slice(0, eq).trim();
      }
      const nm = /^([A-Za-z_]\w*[?!]?)/.exec(seg);
      name = nm ? nm[1]! : seg;
    }

    if (!name) continue;
    const param: Parameter = { name };
    if (rest) param.rest = true;
    if (optional) param.optional = true;
    result.push(param);
  }
  return result;
}

/**
 * `attr_reader`/`attr_writer`/`attr_accessor :a, :b` → metody bez parametrů.
 * `reader`/`accessor` přidá `name`, `writer`/`accessor` přidá `name=`. Respektuje
 * viditelnost (jen `public`) a přidává jen do top-level typu.
 */
function handleAttr(
  keyword: string,
  stmt: string,
  frames: Frame[],
  forcedVis: Visibility | undefined,
): void {
  const scope = nearestScope(frames);
  if (!scope || !scope.isType || !scope.exp || !scope.methods) return;
  const vis = forcedVis ?? scope.visibility ?? 'public';
  if (vis !== 'public') return;

  const args = stmt.slice(keyword.length);
  const names = [...args.matchAll(/:([A-Za-z_]\w*[?!]?)/g)].map((m) => m[1]!);
  const reader = keyword === 'attr_reader' || keyword === 'attr_accessor';
  const writer = keyword === 'attr_writer' || keyword === 'attr_accessor';
  for (const name of names) {
    if (reader) scope.methods.push({ name, signature: { parameters: [] } });
    if (writer) {
      scope.methods.push({ name: `${name}=`, signature: { parameters: [{ name: 'value' }] } });
    }
  }
}

/** Uzavře rámec: typu/funkci doplní `endLine` a typu připne posbírané metody. */
function closeFrame(frame: Frame, lineNo: number): void {
  if (frame.exp) {
    frame.exp.endLine = lineNo;
    if (frame.methods && frame.methods.length > 0) {
      frame.exp.methods = frame.methods;
    }
  }
  if (frame.fnExport) {
    frame.fnExport.endLine = lineNo;
  }
}
