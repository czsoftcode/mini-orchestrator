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
 * Regex/scanner-based Kotlin mapper. Pracuje nad očištěnou variantou zdroje, kde
 * jsou komentáře (`//`, `/* *​/` — Kotlin je **vnořuje** — i KDoc `/** *​/`),
 * stringy (`"..."`), raw stringy (`"""..."""`, víceřádkové) i char literály
 * (`'x'`) nahrazené mezerami stejné délky (`\n` se zachovává, aby čísla řádků
 * seděla). `import` cesty jsou identifikátory (žádné stringy), takže stačí jedna
 * varianta.
 *
 * Mapuje top-level `fun` (jako `function` export se signaturou) a typy
 * (`class` / `interface` / `object` / `enum class` / `data class` / `sealed
 * class|interface` / `annotation class`) na brace-depth 0. Default viditelnost
 * v Kotlinu je `public` → typ/funkce je export, pokud není `private` ani
 * `internal`. Uvnitř těla typu se hledají stejně viditelné metody (`fun`) jako
 * `methods`. Záměrně konzervativní: do těl funkcí ani vnořených typů se
 * nezanořuje, top-level `package` slouží jen jako kontext (FileGraph ho nenese).
 */
export function mapKotlinFile(content: string, relPath: string): FileGraph {
  const stripped = stripKotlin(content);
  const imports = extractKotlinImports(stripped);
  const exports = extractKotlinExports(stripped);
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
 * Smaže komentáře (`//` řádkové, `/* *​/` i KDoc `/** *​/` blokové — Kotlin je
 * **vnořuje**, takže držíme hloubku), stringy (`"..."` s escapy), raw stringy
 * (`"""..."""` bez escapů, víceřádkové) a char literály (`'x'`, `'\n'`).
 * Nahrazuje mezerami stejné délky se zachováním `\n`, takže pozice i čísla řádků
 * zůstávají. String/char literály se vždy korektně přeskočí, aby `//` uvnitř
 * stringu nebylo bráno jako komentář.
 */
function stripKotlin(content: string): string {
  const out: string[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === undefined) break;
    const c2 = content[i + 1];

    // vnořitelný block /* ... */ (vč. KDoc /** ... */)
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

    // raw string """ ... """ — víceřádkový, bez escapů
    if (c === '"' && c2 === '"' && content[i + 2] === '"') {
      out.push(' ', ' ', ' ');
      let j = i + 3;
      while (j < n) {
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

    // char literál 'x' / '\n' / 'é'
    if (c === "'") {
      const m = /^'(?:\\(?:u[0-9A-Fa-f]{4}|.)|[^'\\])'/.exec(content.slice(i));
      if (m) {
        for (let k = 0; k < m[0].length; k++) out.push(' ');
        i += m[0].length;
        continue;
      }
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
 * (funkční typy `() -> Unit`), aby nerozhodila hloubku generik.
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

/** Identifikátor začínající na pozici `p`, nebo `null`. */
function wordAt(text: string, p: number): string | null {
  const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(p));
  return m ? m[0] : null;
}

/** Poslední ne-whitespace znak v rozsahu `[low, from]` (včetně), nebo `''`. */
function lastNonWsChar(text: string, from: number, low: number): string {
  let i = from;
  while (i >= low && isWhitespace(text[i])) i--;
  return i >= low ? (text[i] ?? '') : '';
}

/** Přeskočí anotaci `@Foo`, `@Foo(...)` i s use-site targetem `@field:Foo(...)`. */
function skipAnnotation(text: string, atPos: number): number {
  let p = atPos + 1;
  while (p < text.length && (isWordChar(text[p]) || text[p] === '.' || text[p] === ':')) p++;
  p = skipWs(text, p);
  if (text[p] === '(') return matchParen(text, p) + 1;
  return p;
}

// ---------------------------------------------------------------------------
// Importy
// ---------------------------------------------------------------------------

/**
 * Najde `import a.b.C`, `import a.b.*` a aliasy `import a.b.C as D`. `source` =
 * celá cesta tak, jak je v kódu (bez `as` a bez koncového `;`/EOL). `symbols` =
 * jméno aliasu (`as D` → `D`), jinak poslední segment cesty, u `.*` → `['*']`.
 * `package` direktivy se neberou — slouží jen jako kontext.
 */
function extractKotlinImports(stripped: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const regex = /\bimport\b/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stripped)) !== null) {
    if (m.index > 0 && isWordChar(stripped[m.index - 1])) continue;
    const p = skipWs(stripped, m.index + 'import'.length);
    // import končí novým řádkem nebo `;`
    let end = p;
    while (end < stripped.length && stripped[end] !== '\n' && stripped[end] !== ';') end++;
    const body = stripped.slice(p, end).trim();
    regex.lastIndex = end;
    if (!body) continue;

    // alias `... as Name`
    let alias: string | null = null;
    let pathPart = body;
    const asMatch = /\sas\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(body);
    if (asMatch) {
      alias = asMatch[1] ?? null;
      pathPart = body.slice(0, asMatch.index);
    }
    const path = pathPart.replace(/\s+/g, '');
    if (!path) continue;
    const segments = path.split('.');
    const last = segments[segments.length - 1] ?? path;
    const symbol = alias ?? (last === '*' ? '*' : last);
    imports.push({ source: path, symbols: [symbol] });
  }
  return imports;
}

// ---------------------------------------------------------------------------
// Exporty
// ---------------------------------------------------------------------------

/** Modifikátory deklarace, které přeskakujeme při hledání klíčového slova. */
const DECL_MODIFIERS = new Set([
  'abstract',
  'final',
  'open',
  'sealed',
  'data',
  'inner',
  'inline',
  'value',
  'companion',
  'external',
  'override',
  'suspend',
  'operator',
  'infix',
  'tailrec',
  'const',
  'lateinit',
  'expect',
  'actual',
  'vararg',
  'noinline',
  'crossinline',
  'reified',
]);

type DeclKeyword = 'class' | 'interface' | 'object' | 'fun';

interface Decl {
  /** Pozice začátku deklarace (první anotace / modifikátor). */
  declStart: number;
  /** Pozice klíčového slova. */
  kwPos: number;
  keyword: DeclKeyword;
  isEnum: boolean;
  isAnnotation: boolean;
  /** Default `public` → viditelné; `private`/`internal` → ne. */
  visible: boolean;
}

/**
 * Pokud na pozici `i` (na hranici slova) začíná deklarace, vrátí její popis.
 * Sklouzne přes anotace (`@Foo(...)`) a modifikátory (`open`, `data`, `sealed`,
 * `enum`, `annotation`, viditelnost, …) až ke klíčovému slovu `class`/
 * `interface`/`object`/`fun`. `enum class` → `isEnum`, `annotation class` →
 * `isAnnotation`. `fun interface` se rozpozná (`fun` je tu modifier, klíčové
 * slovo je `interface`). `visible` = nebylo mezi modifikátory `private` ani
 * `internal`.
 */
function declAt(text: string, i: number): Decl | null {
  if (i > 0 && isWordChar(text[i - 1])) return null;

  // declStart = první reálný token (anotace/modifikátor/klíčové slovo), ne
  // případný bílý znak na pozici `i` — aby kotva `line` seděla na deklaraci.
  const declStart = skipWs(text, i);
  let p = declStart;
  let visible = true;
  let isEnum = false;
  let isAnnotation = false;

  while (p < text.length) {
    p = skipWs(text, p);
    if (text[p] === '@') {
      p = skipAnnotation(text, p);
      continue;
    }
    const word = wordAt(text, p);
    if (word === null) return null;

    if (word === 'fun') {
      // `fun interface` → `fun` je modifier funkčního rozhraní
      const after = skipWs(text, p + word.length);
      if (text.startsWith('interface', after) && !isWordChar(text[after + 'interface'.length])) {
        p = after;
        continue;
      }
      return { declStart, kwPos: p, keyword: 'fun', isEnum, isAnnotation, visible };
    }
    if (word === 'class' || word === 'interface' || word === 'object') {
      return { declStart, kwPos: p, keyword: word, isEnum, isAnnotation, visible };
    }
    if (word === 'private' || word === 'internal') {
      visible = false;
      p += word.length;
      continue;
    }
    if (word === 'public' || word === 'protected') {
      p += word.length;
      continue;
    }
    if (word === 'enum') {
      isEnum = true;
      p += word.length;
      continue;
    }
    if (word === 'annotation') {
      isAnnotation = true;
      p += word.length;
      continue;
    }
    if (DECL_MODIFIERS.has(word)) {
      p += word.length;
      continue;
    }
    // něco jiného (val/var/typealias/identifikátor) → tady deklarace nezačíná
    return null;
  }
  return null;
}

/** Mapuje deklaraci typu na `ExportKind`. */
function typeKindFor(decl: Decl): ExportKind {
  if (decl.isEnum) return 'enum';
  if (decl.keyword === 'interface') return 'interface';
  // class, object, data/sealed/abstract class, annotation class
  return 'class';
}

/**
 * Jednoprůchodový sken očištěného textu na brace-depth 0. Najde top-level `fun`
 * (export `function`) a typy (`class`/`interface`/`object`). Tělo se zpracuje
 * zvlášť a sken pokračuje za jeho koncem — dovnitř se znovu nezanořuje.
 */
function extractKotlinExports(stripped: string): ExportInfo[] {
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
    const decl = declAt(stripped, i);
    if (decl) {
      if (decl.keyword === 'fun') {
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
 * Zpracuje typovou deklaraci od `decl`. Najde jméno, tělo `{ ... }` (nebo zjistí,
 * že typ tělo nemá — `data class P(...)`), spočítá kotvy (`line` = `declStart`,
 * `endLine` = `}` / konec hlavičky). Když je typ `visible`, vyrobí `ExportInfo`
 * a doplní viditelné metody z těla. `next` ukazuje za konec deklarace.
 */
function parseType(stripped: string, decl: Decl): TypeResult {
  let p = skipWs(stripped, decl.kwPos + decl.keyword.length);
  const name = wordAt(stripped, p);
  if (name === null) {
    // anonymní (object expression apod.) — přeskoč na konec řádku
    const eol = stripped.indexOf('\n', p);
    return { next: eol === -1 ? stripped.length : eol + 1, export: null };
  }
  p += name.length;

  const body = findClassBody(stripped, p);
  const kind = typeKindFor(decl);

  if (body.brace === -1) {
    // bez těla (např. `data class P(...)`)
    if (!decl.visible) return { next: body.end, export: null };
    const exp: ExportInfo = {
      name,
      kind,
      line: lineAt(stripped, decl.declStart),
      endLine: lineAt(stripped, Math.max(body.end - 1, decl.declStart)),
    };
    return { next: body.end, export: exp };
  }

  const close = matchBrace(stripped, body.brace);
  if (!decl.visible) {
    return { next: close + 1, export: null };
  }
  const exp: ExportInfo = {
    name,
    kind,
    line: lineAt(stripped, decl.declStart),
    endLine: lineAt(stripped, close),
  };
  const methods = parseTypeBody(stripped, body.brace + 1, close);
  if (methods.length > 0) exp.methods = methods;
  return { next: close + 1, export: exp };
}

/**
 * Od pozice za jménem typu najde tělo `{`: scan tracking `()`/`[]`/`<>`. Vrací
 * `brace` = pozice `{` těla (nebo `-1`, když typ tělo nemá) a `end` = pozici, kde
 * deklarace končí (u typu bez těla konec hlavičky). Při novém řádku rozhodne
 * podle kontextu (`:`/`,`/`where`/`by`/`constructor` = hlavička pokračuje).
 */
function findClassBody(text: string, from: number): { brace: number; end: number } {
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
    if (c === '{') return { brace: i, end: i };
    if (c === '\n') {
      const prev = lastNonWsChar(text, i - 1, from);
      if (prev === ':' || prev === ',' || prev === '(') {
        i++;
        continue;
      }
      const nextPos = skipWs(text, i + 1);
      const nc = text[nextPos];
      if (nc === ':' || nc === ',' || nc === '{') {
        i = nextPos;
        continue;
      }
      const w = wordAt(text, nextPos);
      if (w === 'where' || w === 'by' || w === 'constructor') {
        i = nextPos;
        continue;
      }
      return { brace: -1, end: i };
    }
    i++;
  }
  return { brace: -1, end: n };
}

/**
 * Projde tělo typu (mezi `{` a `}`) na jeho top-levelu a vytáhne viditelné
 * metody (`fun`, default `public`, vynechá `private`/`internal`) jako
 * `MethodSignature`. Vlastnosti (`val`/`var`), init bloky, sekundární konstruktory
 * a vnořené typy se přeskočí — model `ExportInfo` pro ně slot nemá. Do těl metod
 * a vnořených typů se nezanořuje.
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
      if (decl.keyword === 'fun') {
        const fn = parseFunctionAt(stripped, decl.kwPos, decl.declStart);
        if (fn) {
          if (decl.visible) methods.push({ name: fn.name, signature: fn.signature });
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
 * Zpracuje `fun` deklaraci od klíčového slova `kwPos`. Přeskočí generika `<T>`
 * i receiver (`fun Foo.bar(...)` → jméno je `bar`), načte parametry, návratový
 * typ (`: Type`) a tělo. Tělo může být blokové (`{ ... }`), výrazové (`= expr`,
 * doskenuje do konce řádku) nebo žádné (abstract/interface/expect). Vrací jméno,
 * signaturu, kotvy a `next` za koncem deklarace.
 */
function parseFunctionAt(stripped: string, kwPos: number, declStart: number): FunctionResult | null {
  let p = skipWs(stripped, kwPos + 'fun'.length);
  // generika <T, R> před jménem
  if (stripped[p] === '<') p = skipWs(stripped, matchAngle(stripped, p) + 1);

  const parenOpen = findParamParen(stripped, p);
  if (parenOpen === -1) return null;
  const name = identBefore(stripped, parenOpen);
  if (name === null) return null;

  const parenClose = matchParen(stripped, parenOpen);
  const signature: FunctionSignature = {
    parameters: parseKotlinParams(stripped.slice(parenOpen + 1, parenClose)),
  };

  // návratový typ `: Type`
  let q = skipWs(stripped, parenClose + 1);
  if (stripped[q] === ':') {
    const rt = readReturnType(stripped, q + 1);
    const t = rt.text.trim();
    if (t) signature.returnType = t;
    q = rt.end;
  }

  // tělo / kotvy
  q = skipWs(stripped, q);
  let endLine: number;
  let next: number;
  if (stripped[q] === '{') {
    const close = matchBrace(stripped, q);
    endLine = lineAt(stripped, close);
    next = close + 1;
  } else if (stripped[q] === '=') {
    const e = skipExpression(stripped, q + 1);
    endLine = lineAt(stripped, Math.max(e - 1, q));
    next = e;
  } else {
    endLine = lineAt(stripped, Math.max(q - 1, parenClose));
    next = q;
  }

  return { name, signature, line: lineAt(stripped, declStart), endLine, next };
}

/** První `(` na angle-depth 0 od `p` (přeskočí receiver typ s generikou). */
function findParamParen(text: string, p: number): number {
  let i = p;
  let angle = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '<') angle++;
    else if (c === '>') {
      if (angle > 0 && text[i - 1] !== '-') angle--;
    } else if (angle === 0) {
      if (c === '(') return i;
      if (c === '{' || c === ';' || c === '=') return -1;
    }
    i++;
  }
  return -1;
}

/** Poslední identifikátor před `(` (za případnou tečkou receiveru), nebo `null`. */
function identBefore(text: string, parenPos: number): string | null {
  let i = parenPos - 1;
  while (i >= 0 && isWhitespace(text[i])) i--;
  let end = i + 1;
  while (i >= 0 && isWordChar(text[i])) i--;
  const name = text.slice(i + 1, end);
  return name.length > 0 ? name : null;
}

/**
 * Načte návratový typ od pozice za `:`. Scan tracking `()`/`[]`/`<>`; končí na
 * `{` / `=` (tělo) nebo na novém řádku na depth 0 (kromě `where` pokračování).
 * Funkční typy `(...) -> X` se přečtou celé (šipka `->` nehází hloubku).
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
    if (c === '{' || c === '=') break;
    if (c === '\n') {
      const nextPos = skipWs(text, i + 1);
      if (wordAt(text, nextPos) === 'where') {
        i = nextPos;
        continue;
      }
      break;
    }
    i++;
  }
  return { text: text.slice(from, i), end: i };
}

/**
 * Doskenuje výrazové tělo funkce (`= expr`) od `from` (za `=`) do konce výrazu:
 * scan tracking `()`/`[]`/`{}`; končí na novém řádku na depth 0 nebo na `;`.
 * Víceřádkové výrazy jsou best-effort (skončí na prvním řádku na depth 0).
 */
function skipExpression(text: string, from: number): number {
  const n = text.length;
  let i = from;
  let depth = 0;
  while (i < n) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (depth === 0) {
      if (c === ';') return i + 1;
      if (c === '\n') return i;
    }
    i++;
  }
  return n;
}

/**
 * Parametry Kotlin funkce. Každý je `name: Type` (volitelně `= default`, modifier
 * `vararg`/`noinline`/`crossinline` či — v primárním konstruktoru — `val`/`var`,
 * anotace `@Foo`). Jméno je **před** dvojtečkou, typ za ní. `vararg` → `rest`,
 * přítomnost `= ...` → `optional`.
 */
function parseKotlinParams(paramsStr: string): Parameter[] {
  const result: Parameter[] = [];
  for (const segRaw of splitTopLevelCommas(paramsStr)) {
    let s = segRaw.trim();
    // anotace parametru
    s = s.replace(/@[A-Za-z_][\w.:]*(?:\([^)]*\))?\s*/g, '');
    s = s.trim();
    if (!s) continue;

    // modifikátory (může jich být víc: `vararg`, `val`, …)
    let rest = false;
    for (;;) {
      const mod = /^(vararg|noinline|crossinline|val|var)\s+/.exec(s);
      if (!mod) break;
      if (mod[1] === 'vararg') rest = true;
      s = s.slice(mod[0].length);
    }
    s = s.trim();
    if (!s) continue;

    const colon = s.indexOf(':');
    let name: string;
    let type: string | undefined;
    let optional = false;
    if (colon !== -1) {
      name = s.slice(0, colon).trim();
      let typePart = s.slice(colon + 1);
      const eq = findDefaultEq(typePart);
      if (eq !== -1) {
        optional = true;
        typePart = typePart.slice(0, eq);
      }
      type = typePart.trim() || undefined;
    } else {
      // bez explicitního typu (`name = default`)
      const eq = findDefaultEq(s);
      if (eq !== -1) {
        optional = true;
        name = s.slice(0, eq).trim();
      } else {
        name = s;
      }
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
