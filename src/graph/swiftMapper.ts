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
 * Regex/scanner-based Swift mapper. Pracuje nad očištěnou variantou zdroje, kde
 * jsou komentáře (`//`, `/* *​/` — Swift je **vnořuje** — i doc `/** *​/`),
 * stringy (`"..."`), víceřádkové stringy (`"""..."""`) i raw stringy
 * (`#"..."#`, `##"..."##`, vč. raw víceřádkových `#"""..."""#`) nahrazené
 * mezerami stejné délky (`\n` se zachovává, aby čísla řádků seděla). `import`
 * cesty jsou identifikátory (žádné stringy), takže stačí jedna varianta.
 *
 * Mapuje top-level `func` (jako `function` export se signaturou) a typy
 * (`class` / `struct` / `enum` / `protocol` / `extension` / `actor`) na
 * brace-depth 0. Default viditelnost ve Swiftu je `internal` (= viditelná v
 * rámci modulu) → typ/funkce je export, pokud není `private` ani `fileprivate`.
 * Uvnitř těla typu se hledají stejně viditelné metody (`func`) jako `methods`.
 * Vlastnosti (`var`/`let`), `init`/`deinit`/`subscript` a enum `case` se
 * nemapují — model `ExportInfo` pro ně slot nemá. Záměrně konzervativní: do těl
 * funkcí ani vnořených typů se nezanořuje.
 */
export function mapSwiftFile(content: string, relPath: string): FileGraph {
  const stripped = stripSwift(content);
  const imports = extractSwiftImports(stripped);
  const exports = extractSwiftExports(stripped);
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
 * Smaže komentáře (`//` řádkové, `/* *​/` i doc `/** *​/` blokové — Swift je
 * **vnořuje**, takže držíme hloubku), stringy (`"..."` s escapy), víceřádkové
 * stringy (`"""..."""`) a raw stringy (`#"..."#` / `##"..."##` / raw
 * víceřádkové `#"""..."""#`). Nahrazuje mezerami stejné délky se zachováním
 * `\n`, takže pozice i čísla řádků zůstávají. String literály se vždy korektně
 * přeskočí, aby `//` uvnitř stringu nebylo bráno jako komentář.
 */
function stripSwift(content: string): string {
  const out: string[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === undefined) break;
    const c2 = content[i + 1];

    // vnořitelný block /* ... */ (vč. doc /** ... */)
    if (c === '/' && c2 === '*') {
      let depth = 0;
      let j = i;
      while (j < n) {
        if (content[j] === '/' && content[j + 1] === '*') {
          out.push(' ', ' ');
          j += 2;
          depth++;
          continue;
        }
        if (content[j] === '*' && content[j + 1] === '/') {
          out.push(' ', ' ');
          j += 2;
          depth--;
          if (depth === 0) break;
          continue;
        }
        out.push(content[j] === '\n' ? '\n' : ' ');
        j++;
      }
      i = j;
      continue;
    }

    // line // ...
    if (c === '/' && c2 === '/') {
      while (i < n && content[i] !== '\n') {
        out.push(' ');
        i++;
      }
      continue;
    }

    // raw string: #+ následované " (vč. víceřádkového #"""). Uzavírá " (resp.
    // """) následované stejným počtem #. Bez escapů (raw), takže jen blankujeme.
    if (c === '#') {
      let h = 0;
      while (content[i + h] === '#') h++;
      if (content[i + h] === '"') {
        const multiline = content[i + h + 1] === '"' && content[i + h + 2] === '"';
        const openLen = h + (multiline ? 3 : 1);
        for (let k = 0; k < openLen; k++) out.push(' ');
        let j = i + openLen;
        const hashes = '#'.repeat(h);
        const quote = multiline ? '"""' : '"';
        while (j < n) {
          if (content.startsWith(quote, j) && content.startsWith(hashes, j + quote.length)) {
            break;
          }
          out.push(content[j] === '\n' ? '\n' : ' ');
          j++;
        }
        if (j < n) {
          const closeLen = quote.length + h;
          for (let k = 0; k < closeLen; k++) out.push(' ');
          j += closeLen;
        }
        i = j;
        continue;
      }
    }

    // víceřádkový string """ ... """ (s escapy)
    if (c === '"' && c2 === '"' && content[i + 2] === '"') {
      out.push(' ', ' ', ' ');
      let j = i + 3;
      while (j < n) {
        if (content[j] === '\\' && j + 1 < n) {
          out.push(content[j] === '\n' ? '\n' : ' ', content[j + 1] === '\n' ? '\n' : ' ');
          j += 2;
          continue;
        }
        if (content[j] === '"' && content[j + 1] === '"' && content[j + 2] === '"') break;
        out.push(content[j] === '\n' ? '\n' : ' ');
        j++;
      }
      if (j < n) {
        out.push(' ', ' ', ' ');
        j += 3;
      }
      i = j;
      continue;
    }

    // string "..." (s escapy)
    if (c === '"') {
      out.push(' ');
      let j = i + 1;
      while (j < n) {
        if (content[j] === '\\' && j + 1 < n) {
          out.push(' ', ' ');
          j += 2;
          continue;
        }
        if (content[j] === '"') break;
        out.push(content[j] === '\n' ? '\n' : ' ');
        j++;
      }
      if (j < n) {
        out.push(' ');
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
// Sdílené pomůcky
// ---------------------------------------------------------------------------

/** Číslo řádku (1-based), na kterém leží znak na dané pozici. */
function lineAt(text: string, position: number): number {
  let line = 1;
  const stop = Math.min(position, text.length);
  for (let i = 0; i < stop; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function matchPair(text: string, openPos: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openPos; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

function matchBrace(text: string, openPos: number): number {
  return matchPair(text, openPos, '{', '}');
}

function matchParen(text: string, openPos: number): number {
  return matchPair(text, openPos, '(', ')');
}

function matchAngle(text: string, openPos: number): number {
  return matchPair(text, openPos, '<', '>');
}

/**
 * Rozdělí seznam parametrů podle čárek na top-levelu. Hloubku počítá pro
 * `(` `[` `{` `<`; uzavírací `>` ignoruje, když je součástí šipky `->`
 * (funkční typy `() -> Void`), aby nerozhodila hloubku generik.
 */
function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === '>') {
      if (s[i - 1] !== '-') depth--;
    } else if (c === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter(Boolean);
}

function isWhitespace(c: string | undefined): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

function isWordChar(c: string | undefined): boolean {
  if (c === undefined) return false;
  return /[A-Za-z0-9_]/.test(c);
}

function skipWs(text: string, pos: number): number {
  let i = pos;
  while (i < text.length && isWhitespace(text[i])) i++;
  return i;
}

/** True, když na pozici `p` začíná nové slovo (předchozí znak není word char). */
function atWordBoundary(text: string, p: number): boolean {
  return p === 0 || !isWordChar(text[p - 1]);
}

/** Identifikátor začínající na pozici `p`, nebo `null`. */
function wordAt(text: string, p: number): string | null {
  const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(p));
  return m ? m[0] : null;
}

/**
 * Tečkami oddělený typový/modulový název od pozice `p` (`Foo`, `Foo.Bar.Baz`),
 * generika (`<...>`) ani nic dalšího nebere. Vrací `null`, když na `p` není
 * identifikátor.
 */
function dottedNameAt(text: string, p: number): string | null {
  const first = wordAt(text, p);
  if (first === null) return null;
  let i = p + first.length;
  let name = first;
  while (text[i] === '.') {
    const seg = wordAt(text, i + 1);
    if (seg === null) break;
    name += `.${seg}`;
    i += 1 + seg.length;
  }
  return name;
}

/** Přeskočí atribut `@Foo`, `@Foo(...)` (např. `@escaping`, `@available(...)`). */
function skipAttribute(text: string, atPos: number): number {
  let p = atPos + 1;
  while (p < text.length && (isWordChar(text[p]) || text[p] === '.')) p++;
  p = skipWs(text, p);
  if (text[p] === '(') return matchParen(text, p) + 1;
  return p;
}

// ---------------------------------------------------------------------------
// Importy
// ---------------------------------------------------------------------------

/** Kindy v `import struct Foo.Bar` apod. — přeskakují se, cesta je až za nimi. */
const IMPORT_KINDS = new Set([
  'typealias',
  'struct',
  'class',
  'enum',
  'protocol',
  'func',
  'var',
  'let',
  'actor',
  'macro',
]);

/**
 * Najde `import Foo`, `import Foo.Bar.Baz` a `import struct Foo.Bar` (kind se
 * přeskočí). `source` = celá tečkami oddělená cesta tak, jak je v kódu;
 * `symbols` = poslední segment cesty.
 */
function extractSwiftImports(stripped: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const regex = /\bimport\b/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stripped)) !== null) {
    if (m.index > 0 && isWordChar(stripped[m.index - 1])) continue;
    let p = skipWs(stripped, m.index + 'import'.length);

    // volitelný kind (`struct`/`class`/…), pokud za ním ještě následuje cesta
    const kind = wordAt(stripped, p);
    if (kind !== null && IMPORT_KINDS.has(kind)) {
      const afterKind = skipWs(stripped, p + kind.length);
      if (wordAt(stripped, afterKind) !== null) p = afterKind;
    }

    const path = dottedNameAt(stripped, p);
    if (path === null) continue;
    regex.lastIndex = p + path.length;
    const segments = path.split('.');
    const last = segments[segments.length - 1] ?? path;
    imports.push({ source: path, symbols: [last] });
  }
  return imports;
}

// ---------------------------------------------------------------------------
// Exporty
// ---------------------------------------------------------------------------

/** Modifikátory deklarace, které přeskakujeme při hledání klíčového slova. */
const DECL_MODIFIERS = new Set([
  'final',
  'open',
  'public',
  'internal',
  'package',
  'override',
  'mutating',
  'nonmutating',
  'lazy',
  'weak',
  'unowned',
  'required',
  'convenience',
  'dynamic',
  'optional',
  'indirect',
  'infix',
  'prefix',
  'postfix',
  'async',
  'nonisolated',
  'distributed',
  'consuming',
  'borrowing',
  'isolated',
]);

type DeclKeyword = 'class' | 'struct' | 'enum' | 'protocol' | 'extension' | 'actor' | 'func';

/** Klíčová slova, která za modifikátorem `class`/`static` značí člena (ne typ). */
const MEMBER_KEYWORDS = new Set(['func', 'var', 'let', 'subscript', 'init']);

interface Decl {
  /** Pozice začátku deklarace (první atribut / modifikátor / klíčové slovo). */
  declStart: number;
  /** Pozice klíčového slova. */
  kwPos: number;
  keyword: DeclKeyword;
  /** Default `internal` → viditelné; `private`/`fileprivate` → ne. */
  visible: boolean;
  /** `static` nebo `class` modifier (typová metoda). */
  isStatic: boolean;
}

/**
 * Pokud na pozici `i` (na hranici slova) začíná deklarace, vrátí její popis.
 * Sklouzne přes atributy (`@Foo(...)`) a modifikátory (`final`, `public`,
 * `static`, …) až ke klíčovému slovu `class`/`struct`/`enum`/`protocol`/
 * `extension`/`actor`/`func`. `class`/`static` před členem (`func`/`var`/…) je
 * modifier (→ `isStatic`), `class` jinak typová deklarace. `visible` = nebylo
 * mezi modifikátory `private` ani `fileprivate` (kromě `private(set)`).
 */
function declAt(text: string, i: number): Decl | null {
  if (i > 0 && isWordChar(text[i - 1])) return null;

  // declStart = první reálný token (atribut/modifikátor/klíčové slovo), ne
  // případný bílý znak na pozici `i` — aby kotva `line` seděla na deklaraci.
  const declStart = skipWs(text, i);
  let p = declStart;
  let visible = true;
  let isStatic = false;

  while (p < text.length) {
    p = skipWs(text, p);
    if (text[p] === '@') {
      p = skipAttribute(text, p);
      continue;
    }
    const word = wordAt(text, p);
    if (word === null) return null;

    if (
      word === 'func' ||
      word === 'struct' ||
      word === 'enum' ||
      word === 'protocol' ||
      word === 'extension' ||
      word === 'actor'
    ) {
      return { declStart, kwPos: p, keyword: word, visible, isStatic };
    }
    if (word === 'class') {
      // `class func`/`class var` → `class` je modifier typové metody/vlastnosti
      const after = skipWs(text, p + word.length);
      const nextWord = wordAt(text, after);
      if (nextWord !== null && MEMBER_KEYWORDS.has(nextWord)) {
        isStatic = true;
        p = after;
        continue;
      }
      return { declStart, kwPos: p, keyword: 'class', visible, isStatic };
    }
    if (word === 'static') {
      isStatic = true;
      p += word.length;
      continue;
    }
    if (word === 'private' || word === 'fileprivate') {
      // `private(set)`/`fileprivate(set)` omezuje jen setter → deklarace zůstává viditelná
      const after = skipWs(text, p + word.length);
      if (text[after] === '(') {
        p = matchParen(text, after) + 1;
        continue;
      }
      visible = false;
      p += word.length;
      continue;
    }
    if (DECL_MODIFIERS.has(word)) {
      // viditelnostní `public`/`internal`/… mohou mít `(set)`
      const after = skipWs(text, p + word.length);
      if (text[after] === '(') {
        p = matchParen(text, after) + 1;
        continue;
      }
      p += word.length;
      continue;
    }
    // něco jiného (var/let/case/init/identifikátor) → tady deklarace nezačíná
    return null;
  }
  return null;
}

/** Mapuje deklaraci typu na `ExportKind`. */
function typeKindFor(decl: Decl): ExportKind {
  switch (decl.keyword) {
    case 'struct':
      return 'struct';
    case 'enum':
      return 'enum';
    case 'protocol':
      return 'interface';
    // class, actor, extension
    default:
      return 'class';
  }
}

/**
 * Jednoprůchodový sken očištěného textu na brace-depth 0. Najde top-level `func`
 * (export `function`) a typy. Tělo se zpracuje zvlášť a sken pokračuje za jeho
 * koncem — dovnitř se znovu nezanořuje.
 */
function extractSwiftExports(stripped: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const n = stripped.length;
  let i = 0;
  let depth = 0;
  while (i < n) {
    const c = stripped[i];
    if (c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      depth--;
      i++;
      continue;
    }
    if (depth !== 0) {
      i++;
      continue;
    }
    // `import struct Foo.Bar` apod. — kindové klíčové slovo by se jinak vzalo
    // jako deklarace typu; importy přeskoč na konec řádku.
    if (c === 'i' && atWordBoundary(stripped, i) && wordAt(stripped, i) === 'import') {
      const eol = stripped.indexOf('\n', i);
      i = eol === -1 ? n : eol + 1;
      continue;
    }
    const decl = declAt(stripped, i);
    if (decl) {
      if (decl.keyword === 'func') {
        const fn = parseFunctionAt(stripped, decl.kwPos, decl.declStart);
        if (fn) {
          if (decl.visible) {
            const exp: ExportInfo = {
              name: fn.name,
              kind: 'function',
              signature: fn.signature,
              line: fn.line,
              endLine: fn.endLine,
            };
            exports.push(exp);
          }
          i = Math.max(fn.next, i + 1);
          continue;
        }
      } else {
        const r = parseType(stripped, decl);
        if (r.export) exports.push(r.export);
        i = Math.max(r.next, i + 1);
        continue;
      }
    }
    i++;
  }
  return exports;
}

interface TypeResult {
  next: number;
  export: ExportInfo | null;
}

/**
 * Zpracuje typovou deklaraci od `decl`. Najde jméno (u `extension` i tečkami
 * oddělené, např. `Swift.String`), tělo `{ ... }` a kotvy (`line` = `declStart`,
 * `endLine` = `}`). Když je typ `visible`, vyrobí `ExportInfo` a doplní viditelné
 * metody z těla. `next` ukazuje za konec deklarace.
 */
function parseType(stripped: string, decl: Decl): TypeResult {
  let p = skipWs(stripped, decl.kwPos + decl.keyword.length);
  const name = dottedNameAt(stripped, p);
  if (name === null) {
    // anonymní / neočekávané — přeskoč na konec řádku
    const eol = stripped.indexOf('\n', p);
    return { next: eol === -1 ? stripped.length : eol + 1, export: null };
  }
  p += name.length;

  const brace = findTypeBrace(stripped, p);
  if (brace === -1) {
    // tělo nenalezeno (nečekané) — přeskoč na konec řádku
    const eol = stripped.indexOf('\n', p);
    return { next: eol === -1 ? stripped.length : eol + 1, export: null };
  }

  const close = matchBrace(stripped, brace);
  if (!decl.visible) {
    return { next: close + 1, export: null };
  }
  const exp: ExportInfo = {
    name,
    kind: typeKindFor(decl),
    line: lineAt(stripped, decl.declStart),
    endLine: lineAt(stripped, close),
  };
  const methods = parseTypeBody(stripped, brace + 1, close);
  if (methods.length > 0) exp.methods = methods;
  return { next: close + 1, export: exp };
}

/**
 * Od pozice za jménem typu najde `{` těla: scan tracking `()`/`[]`/`<>`. Swift
 * typy (class/struct/enum/protocol/extension/actor) mají vždy tělo, takže
 * `where` klauzule i dědičnost (`: Base, Proto`) jen přeskočíme. Vrací pozici
 * `{`, nebo `-1`, když ho do konce textu nenajde.
 */
function findTypeBrace(text: string, from: number): number {
  const n = text.length;
  let i = from;
  let paren = 0;
  let angle = 0;
  while (i < n) {
    const c = text[i];
    if (c === '(' || c === '[') {
      paren++;
      i++;
      continue;
    }
    if (c === ')' || c === ']') {
      if (paren > 0) paren--;
      i++;
      continue;
    }
    if (c === '<') {
      angle++;
      i++;
      continue;
    }
    if (c === '>') {
      if (angle > 0 && text[i - 1] !== '-') angle--;
      i++;
      continue;
    }
    if (paren > 0 || angle > 0) {
      i++;
      continue;
    }
    if (c === '{') return i;
    i++;
  }
  return -1;
}

/**
 * Projde tělo typu (mezi `{` a `}`) na jeho top-levelu a vytáhne viditelné
 * metody (`func`, default `internal`, vynechá `private`/`fileprivate`) jako
 * `MethodSignature`. Vlastnosti (`var`/`let`), `init`/`deinit`/`subscript`,
 * enum `case` a vnořené typy se přeskočí — model `ExportInfo` pro ně slot nemá.
 * Do těl metod a vnořených typů se nezanořuje.
 */
function parseTypeBody(stripped: string, from: number, to: number): MethodSignature[] {
  const methods: MethodSignature[] = [];
  let i = from;
  let depth = 0;
  while (i < to) {
    const c = stripped[i];
    if (c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      depth--;
      i++;
      continue;
    }
    if (depth !== 0) {
      i++;
      continue;
    }
    const decl = declAt(stripped, i);
    if (decl) {
      if (decl.keyword === 'func') {
        const fn = parseFunctionAt(stripped, decl.kwPos, decl.declStart);
        if (fn) {
          if (decl.visible) {
            const method: MethodSignature = { name: fn.name, signature: fn.signature };
            if (decl.isStatic) method.isStatic = true;
            methods.push(method);
          }
          i = Math.max(fn.next, i + 1);
          continue;
        }
      } else {
        // vnořený typ → přeskoč celý
        const r = parseType(stripped, { ...decl, visible: false });
        i = Math.max(r.next, i + 1);
        continue;
      }
    }
    i++;
  }
  return methods;
}

interface FunctionResult {
  name: string;
  signature: FunctionSignature;
  line: number;
  endLine: number;
  next: number;
}

/**
 * Zpracuje `func` deklaraci od klíčového slova `kwPos`. Načte jméno, přeskočí
 * generika `<T>`, načte parametry, efektové specifikátory (`async`/`throws`),
 * návratový typ (`-> Type`), případnou `where` klauzuli a tělo. Tělo může být
 * blokové (`{ ... }`) nebo žádné (požadavek v protokolu). Vrací jméno,
 * signaturu, kotvy a `next` za koncem deklarace. Operátorové funkce
 * (`func +(...)`) přeskočí (`null`).
 */
function parseFunctionAt(stripped: string, kwPos: number, declStart: number): FunctionResult | null {
  let p = skipWs(stripped, kwPos + 'func'.length);
  const name = wordAt(stripped, p);
  if (name === null) return null; // operátorová funkce
  p += name.length;
  p = skipWs(stripped, p);

  // generika <T, R> za jménem
  if (stripped[p] === '<') p = skipWs(stripped, matchAngle(stripped, p) + 1);

  if (stripped[p] !== '(') return null;
  const parenOpen = p;
  const parenClose = matchParen(stripped, parenOpen);
  const signature: FunctionSignature = {
    parameters: parseSwiftParams(stripped.slice(parenOpen + 1, parenClose)),
  };

  // efektové specifikátory: async / throws / rethrows / reasync
  let q = skipWs(stripped, parenClose + 1);
  for (;;) {
    const w = wordAt(stripped, q);
    if (w === 'async' || w === 'throws' || w === 'rethrows' || w === 'reasync') {
      q = skipWs(stripped, q + w.length);
      continue;
    }
    break;
  }

  // návratový typ `-> Type`
  if (stripped[q] === '-' && stripped[q + 1] === '>') {
    const rt = readReturnType(stripped, q + 2);
    const t = rt.text.trim();
    if (t) signature.returnType = t;
    q = rt.end;
  }

  // případná `where` klauzule před tělem
  q = skipWs(stripped, q);
  if (wordAt(stripped, q) === 'where') {
    const brace = stripped.indexOf('{', q);
    const eol = stripped.indexOf('\n', q);
    q = brace !== -1 && (eol === -1 || brace < eol) ? brace : eol === -1 ? stripped.length : eol;
  }

  // tělo / kotvy
  q = skipWs(stripped, q);
  let endLine: number;
  let next: number;
  if (stripped[q] === '{') {
    const close = matchBrace(stripped, q);
    endLine = lineAt(stripped, close);
    next = close + 1;
  } else {
    // bez těla (požadavek v protokolu)
    endLine = lineAt(stripped, Math.max(q - 1, parenClose));
    next = q;
  }

  return { name, signature, line: lineAt(stripped, declStart), endLine, next };
}

/**
 * Načte návratový typ od pozice za `->`. Scan tracking `()`/`[]`/`<>`; končí na
 * `{` (tělo), na `where` (na depth 0) nebo na novém řádku na depth 0. Funkční
 * typy `(...) -> X` se přečtou celé (šipka `->` nehází hloubku).
 */
function readReturnType(text: string, from: number): { text: string; end: number } {
  const n = text.length;
  let i = from;
  let paren = 0;
  let angle = 0;
  while (i < n) {
    const c = text[i];
    if (c === '(' || c === '[') {
      paren++;
      i++;
      continue;
    }
    if (c === ')' || c === ']') {
      if (paren > 0) paren--;
      i++;
      continue;
    }
    if (c === '<') {
      angle++;
      i++;
      continue;
    }
    if (c === '>') {
      if (angle > 0 && text[i - 1] !== '-') angle--;
      i++;
      continue;
    }
    if (paren > 0 || angle > 0) {
      i++;
      continue;
    }
    if (c === '{') break;
    if (c === '\n') break;
    if (c === 'w' && wordAt(text, i) === 'where') break;
    i++;
  }
  return { text: text.slice(from, i), end: i };
}

/** Pozice prvního `:` na top-levelu (mimo `()`/`[]`/`<>`), nebo `-1`. */
function findTopLevelColon(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '<') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === '>') {
      if (s[i - 1] !== '-') depth--;
    } else if (c === ':' && depth === 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Parametry Swift funkce. Každý je `[externalLabel] internalName: Type` (volitelně
 * `= default`, modifier `inout`, atribut `@escaping`). Jméno bereme **interní**
 * (poslední token před `:`); `_ name` → `name`, `with prefix` → `prefix`.
 * Variadický typ (`Int...`) → `rest`, přítomnost `= ...` → `optional`.
 */
function parseSwiftParams(paramsStr: string): Parameter[] {
  const result: Parameter[] = [];
  for (const segRaw of splitTopLevelCommas(paramsStr)) {
    let s = segRaw.trim();
    // atributy parametru (`@escaping`, `@autoclosure`, …)
    s = s.replace(/@[A-Za-z_][\w.]*(?:\([^)]*\))?\s*/g, '');
    s = s.trim();
    if (!s) continue;

    const colon = findTopLevelColon(s);
    let name: string;
    let type: string | undefined;
    let optional = false;
    let rest = false;

    if (colon !== -1) {
      const labels = s.slice(0, colon).trim().split(/\s+/).filter(Boolean);
      name = labels[labels.length - 1] ?? '_';
      let typePart = s.slice(colon + 1).trim();
      // inout modifier před typem
      typePart = typePart.replace(/^inout\s+/, '');
      const eq = findDefaultEq(typePart);
      if (eq !== -1) {
        optional = true;
        typePart = typePart.slice(0, eq).trim();
      }
      if (typePart.endsWith('...')) {
        rest = true;
        typePart = typePart.slice(0, -3).trim();
      }
      type = typePart || undefined;
    } else {
      // bez explicitního typu — nečekané; vezmi poslední token jako jméno
      const eq = findDefaultEq(s);
      if (eq !== -1) {
        optional = true;
        s = s.slice(0, eq).trim();
      }
      const tokens = s.split(/\s+/).filter(Boolean);
      name = tokens[tokens.length - 1] ?? '_';
    }

    const param: Parameter = { name: name || '_' };
    if (type) param.type = type;
    if (rest) param.rest = true;
    if (optional) param.optional = true;
    result.push(param);
  }
  return result;
}

/** Pozice prvního `=` přiřazení default hodnoty (ne `==`/`<=`/`>=`/`!=`/`->`). */
function findDefaultEq(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '=') continue;
    const prev = s[i - 1];
    const next = s[i + 1];
    if (prev === '=' || prev === '<' || prev === '>' || prev === '!') continue;
    if (next === '=') continue;
    return i;
  }
  return -1;
}
