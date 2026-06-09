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
 * Regex/scanner-based C/C++ mapper. Works on a cleaned-up variant of the source
 * where comments (`//`, `/* *​/` — C/C++ do not nest them), string literals
 * (`"..."`, raw `R"delim(...)delim"` with optional `u8`/`u`/`U`/`L` prefixes)
 * and char literals (`'x'`, `'\n'`) are replaced by spaces of the same length
 * (`\n` is kept so line numbers stay correct). Preprocessor directive lines are
 * blanked too (after `#include` extraction), so macros never look like code.
 *
 * Imports are `#include` directives: a local include (`#include "util/foo.h"`)
 * keeps the path as `source` (`util/foo.h`), a system include keeps the angle
 * form (`<vector>`) so the two stay distinguishable. `symbols` holds the file
 * base name without extension (`foo`, `vector`).
 *
 * Exports are file-level declarations — free functions (definitions and
 * prototypes), `class`/`struct` definitions with their public methods, `enum`
 * (incl. `enum class`), `typedef` and `using` aliases. `namespace { ... }` and
 * `extern "C" { ... }` braces are transparent, so declarations inside them are
 * still mapped. Deliberately conservative: out-of-class method definitions
 * (`void Foo::bar()`), `operator` overloads, destructors and forward
 * declarations are skipped, and `static` free functions are mapped only in
 * headers (`.h`/`.hpp`/`.hh`), where `static inline` is part of the API — in
 * source files `static` means file-local.
 */
export function mapCppFile(content: string, relPath: string): FileGraph {
  const { stripped, includes } = stripCpp(content);
  const noPreproc = blankPreprocessor(stripped);
  const exports = extractCppExports(noPreproc, isHeaderPath(relPath));
  return {
    path: relPath.replace(/\\/g, '/'),
    exports,
    imports: includes,
  };
}

/** True for header files, where `static` functions still count as API. */
function isHeaderPath(relPath: string): boolean {
  return /\.(h|hpp|hh)$/.test(relPath);
}

// ---------------------------------------------------------------------------
// Stripping
// ---------------------------------------------------------------------------

/**
 * Blanks comments, strings and char literals (same-length spaces, `\n` kept)
 * and collects `#include` targets along the way — the include path itself is a
 * string/angle form, so it has to be captured before blanking. The look-back
 * (`lineIsIncludePrefix`) checks that the current output line is exactly
 * `#include` so far, which keeps fake includes inside comments out.
 */
function stripCpp(content: string): { stripped: string; includes: ImportInfo[] } {
  const out: string[] = [];
  const includes: ImportInfo[] = [];
  const n = content.length;
  let i = 0;
  let lineStartOut = 0;

  const lineIsIncludePrefix = (): boolean =>
    /^[ \t]*#[ \t]*include[ \t]*$/.test(out.slice(lineStartOut).join(''));

  const pushBlanked = (from: number, to: number): void => {
    for (let k = from; k < to; k++) {
      if (content[k] === '\n') {
        out.push('\n');
        lineStartOut = out.length;
      } else {
        out.push(' ');
      }
    }
  };

  while (i < n) {
    const c = content[i];
    if (c === undefined) break;
    const c2 = content[i + 1];

    if (c === '\n') {
      out.push('\n');
      i++;
      lineStartOut = out.length;
      continue;
    }

    // block /* ... */ — C/C++ do not nest them
    if (c === '/' && c2 === '*') {
      const end = content.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      pushBlanked(i, stop);
      i = stop;
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

    // raw string R"delim( ... )delim", optionally prefixed u8/u/U/L
    if (
      (c === 'R' || c === 'u' || c === 'U' || c === 'L') &&
      !isWordChar(i > 0 ? content[i - 1] : undefined)
    ) {
      const m = /^(?:u8|[uUL])?R"([^\s()\\]{0,16})\(/.exec(content.slice(i, i + 24));
      if (m && m[1] !== undefined) {
        const close = `)${m[1]}"`;
        const end = content.indexOf(close, i + m[0].length);
        const stop = end === -1 ? n : end + close.length;
        pushBlanked(i, stop);
        i = stop;
        continue;
      }
    }

    // string literal "..."
    if (c === '"') {
      if (lineIsIncludePrefix()) {
        const close = content.indexOf('"', i + 1);
        const nl = content.indexOf('\n', i + 1);
        if (close !== -1 && (nl === -1 || close < nl)) {
          const path = content.slice(i + 1, close);
          includes.push({ source: path, symbols: [includeSymbol(path)] });
        }
      }
      out.push(' ');
      i++;
      while (i < n) {
        if (content[i] === '\\' && i + 1 < n) {
          out.push(' ', ' ');
          i += 2;
          continue;
        }
        if (content[i] === '"') {
          out.push(' ');
          i++;
          break;
        }
        if (content[i] === '\n') {
          // unterminated string — keep the line structure and bail out
          out.push('\n');
          i++;
          lineStartOut = out.length;
          break;
        }
        out.push(' ');
        i++;
      }
      continue;
    }

    // system include <...> — only when the line so far is exactly `#include`
    if (c === '<' && lineIsIncludePrefix()) {
      const close = content.indexOf('>', i + 1);
      const nl = content.indexOf('\n', i + 1);
      if (close !== -1 && (nl === -1 || close < nl)) {
        const path = content.slice(i + 1, close);
        includes.push({ source: `<${path}>`, symbols: [includeSymbol(path)] });
        pushBlanked(i, close + 1);
        i = close + 1;
        continue;
      }
    }

    // char literal 'x' / '\n' — the word-char guard skips digit separators (1'000)
    if (c === "'" && !isWordChar(i > 0 ? content[i - 1] : undefined)) {
      const m = /^'(?:\\(?:x[0-9A-Fa-f]+|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|[0-7]{1,3}|.)|[^'\\\n])'/.exec(
        content.slice(i),
      );
      if (m) {
        for (let k = 0; k < m[0].length; k++) out.push(' ');
        i += m[0].length;
        continue;
      }
    }

    out.push(c);
    i++;
  }
  return { stripped: out.join(''), includes };
}

/** Base name of an include path without directory and extension. */
function includeSymbol(path: string): string {
  const segments = path.split('/');
  const base = segments[segments.length - 1] ?? path;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * Blanks preprocessor directive lines (incl. `\` continuations), keeping the
 * line lengths, so `#define` macro bodies never look like declarations.
 */
function blankPreprocessor(stripped: string): string {
  const lines = stripped.split('\n');
  let continued = false;
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx] ?? '';
    const isDirective: boolean = continued || /^[ \t]*#/.test(line);
    continued = isDirective && /\\[ \t]*$/.test(line);
    if (isDirective) lines[idx] = ' '.repeat(line.length);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Line number (1-based) of the character at the given position. */
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

function matchSquare(text: string, openPos: number): number {
  return matchPair(text, openPos, '[', ']');
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '{' || c === '(' || c === '[' || c === '<') depth++;
    else if (c === '}' || c === ')' || c === ']' || c === '>') depth--;
    else if (c === ',' && depth === 0) {
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

/** Identifier starting at position `p`, or `null`. */
function wordAt(text: string, p: number): string | null {
  const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(p));
  return m ? m[0] : null;
}

/**
 * Skips one file-level statement from `pos`: ends after `;` or after a `{...}`
 * body, whichever comes first; `(...)` groups are skipped as a whole. Stops in
 * front of a stray `}` (end of an enclosing body).
 */
function skipStatement(text: string, pos: number): number {
  let i = pos;
  while (i < text.length) {
    const c = text[i];
    if (c === ';') return i + 1;
    if (c === '{') return matchBrace(text, i) + 1;
    if (c === '}') return i;
    if (c === '(') {
      i = matchParen(text, i) + 1;
      continue;
    }
    i++;
  }
  return text.length;
}

/** Position of the next top-level `;` from `pos` (skipping `(){}<>` groups). */
function findSemi(text: string, pos: number): number {
  let i = pos;
  while (i < text.length) {
    const c = text[i];
    if (c === ';') return i;
    if (c === '{') {
      i = matchBrace(text, i) + 1;
      continue;
    }
    if (c === '(') {
      i = matchParen(text, i) + 1;
      continue;
    }
    if (c === '<') {
      i = matchAngle(text, i) + 1;
      continue;
    }
    i++;
  }
  return text.length;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

interface DeclResult {
  next: number;
  exp: ExportInfo | null;
}

/** Declaration modifiers skipped while looking for the declared entity. */
const DECL_MODIFIERS = new Set([
  'static',
  'inline',
  'extern',
  'constexpr',
  'consteval',
  'constinit',
  'virtual',
  'explicit',
  'friend',
  'register',
  'thread_local',
  '_Noreturn',
]);

/** Words allowed between a function's `)` and its body/`;`. */
const FN_TAIL_WORDS = new Set(['const', 'noexcept', 'override', 'final', 'throw']);

/** Member modifiers skipped while looking for a method name. */
const MEMBER_MODIFIERS = new Set([
  'static',
  'inline',
  'virtual',
  'explicit',
  'constexpr',
  'consteval',
  'mutable',
  'extern',
  'thread_local',
]);

/**
 * Single pass over the cleaned-up text. At file level (with `namespace` and
 * `extern "C"` braces transparent) it looks for declarations; each handled
 * declaration is skipped as a whole (incl. its body), so the scan never
 * descends into function bodies.
 */
function extractCppExports(stripped: string, isHeader: boolean): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const transparent = new Set<number>();
  const n = stripped.length;
  let depth = 0;
  let i = 0;
  while (i < n) {
    const c = stripped[i];
    if (c === '{') {
      depth++;
      i++;
      continue;
    }
    if (c === '}') {
      if (transparent.has(i)) transparent.delete(i);
      else depth--;
      i++;
      continue;
    }
    if (depth !== 0) {
      i++;
      continue;
    }
    if (!isWordChar(c) || (i > 0 && isWordChar(stripped[i - 1]))) {
      i++;
      continue;
    }

    const declStart = i;
    let p = i;
    let word = wordAt(stripped, p);
    if (!word) {
      i++;
      continue;
    }

    // template<...> prefix — the declaration after it is still mapped
    if (word === 'template') {
      let q = skipWs(stripped, p + word.length);
      if (stripped[q] === '<') q = skipWs(stripped, matchAngle(stripped, q) + 1);
      p = q;
      word = wordAt(stripped, p);
      if (!word) {
        i = Math.max(p, i + 1);
        continue;
      }
    }

    if (word === 'namespace') {
      let q = skipWs(stripped, p + word.length);
      while (q < n && (isWordChar(stripped[q]) || stripped[q] === ':')) q++;
      q = skipWs(stripped, q);
      if (stripped[q] === '{') {
        transparent.add(matchBrace(stripped, q));
        i = q + 1;
        continue;
      }
      // namespace alias (`namespace x = a::b;`)
      i = Math.max(skipStatement(stripped, q), i + 1);
      continue;
    }

    if (word === 'extern') {
      const q = skipWs(stripped, p + word.length);
      // `extern "C" {` — the string is blanked, so the brace follows directly
      if (stripped[q] === '{') {
        transparent.add(matchBrace(stripped, q));
        i = q + 1;
        continue;
      }
      // plain `extern` modifier — falls through to declaration parsing
    }

    let r: DeclResult;
    if (word === 'typedef') r = parseTypedef(stripped, declStart);
    else if (word === 'using') r = parseUsing(stripped, declStart, p);
    else r = parseDecl(stripped, declStart, p, isHeader);
    if (r.exp) exports.push(r.exp);
    i = Math.max(r.next, i + 1);
  }
  return exports;
}

/** Skips modifiers and dispatches to class/struct, enum or free function. */
function parseDecl(
  stripped: string,
  declStart: number,
  from: number,
  isHeader: boolean,
): DeclResult {
  let p = from;
  let isStatic = false;
  for (;;) {
    p = skipWs(stripped, p);
    if (stripped[p] === '[' && stripped[p + 1] === '[') {
      p = matchSquare(stripped, p) + 1;
      continue;
    }
    const word = wordAt(stripped, p);
    if (word === null) break;
    if (word === 'static') {
      isStatic = true;
      p += word.length;
      continue;
    }
    if (DECL_MODIFIERS.has(word)) {
      p += word.length;
      continue;
    }
    break;
  }
  const word = wordAt(stripped, p);
  if (word === 'class' || word === 'struct') return parseClassLike(stripped, declStart, p, word);
  if (word === 'enum') return parseEnum(stripped, declStart, p);
  if (word === 'union') return { next: skipStatement(stripped, p), exp: null };
  return parseFunction(stripped, declStart, p, isStatic, isHeader);
}

/**
 * `class`/`struct` definition with a body. Forward declarations (`class Foo;`)
 * and variable declarations (`struct Foo var;`, `struct Foo var = {...};`) are
 * skipped — between the name and `{` only a base list / `final` may appear.
 */
function parseClassLike(
  stripped: string,
  declStart: number,
  kwPos: number,
  kw: 'class' | 'struct',
): DeclResult {
  const n = stripped.length;
  let p = skipWs(stripped, kwPos + kw.length);
  if (stripped[p] === '[' && stripped[p + 1] === '[') {
    p = skipWs(stripped, matchSquare(stripped, p) + 1);
  }
  const name = wordAt(stripped, p);
  if (name === null) return { next: skipStatement(stripped, p), exp: null };
  const afterName = p + name.length;

  let scan = afterName;
  let brace = -1;
  while (scan < n) {
    const c = stripped[scan];
    if (c === '{') {
      brace = scan;
      break;
    }
    if (c === ';' || c === '=' || c === '(') break;
    if (c === '<') {
      scan = matchAngle(stripped, scan) + 1;
      continue;
    }
    scan++;
  }
  if (brace === -1) return { next: skipStatement(stripped, afterName), exp: null };

  const between = stripped.slice(afterName, brace).trim();
  const isDefinition =
    between === '' || between.startsWith(':') || between === 'final' || between.startsWith('final ') || between.startsWith('final:');
  if (!isDefinition) return { next: skipStatement(stripped, afterName), exp: null };

  const close = matchBrace(stripped, brace);
  const exp: ExportInfo = {
    name,
    kind: kw === 'class' ? 'class' : 'struct',
    line: lineAt(stripped, declStart),
    endLine: lineAt(stripped, close),
  };
  const methods = parseClassBody(stripped, brace + 1, close, kw === 'struct');
  if (methods.length > 0) exp.methods = methods;
  return { next: close + 1, exp };
}

/** `enum [class|struct] Name [: base] { ... }` — anonymous enums are skipped. */
function parseEnum(stripped: string, declStart: number, kwPos: number): DeclResult {
  let p = skipWs(stripped, kwPos + 'enum'.length);
  const cs = wordAt(stripped, p);
  if (cs === 'class' || cs === 'struct') p = skipWs(stripped, p + cs.length);
  const name = wordAt(stripped, p);
  if (name === null) return { next: skipStatement(stripped, p), exp: null };
  const afterName = p + name.length;

  let scan = afterName;
  let brace = -1;
  while (scan < stripped.length) {
    const c = stripped[scan];
    if (c === '{') {
      brace = scan;
      break;
    }
    if (c === ';' || c === '=' || c === '(') break;
    scan++;
  }
  if (brace === -1) return { next: skipStatement(stripped, afterName), exp: null };
  const between = stripped.slice(afterName, brace).trim();
  if (between !== '' && !between.startsWith(':')) {
    return { next: skipStatement(stripped, afterName), exp: null };
  }
  const close = matchBrace(stripped, brace);
  return {
    next: close + 1,
    exp: { name, kind: 'enum', line: lineAt(stripped, declStart), endLine: lineAt(stripped, close) },
  };
}

/**
 * `typedef ...;` — for `typedef struct {...} Name;` the name follows the body
 * and the kind mirrors the defined entity; for function-pointer typedefs the
 * name sits inside `(*Name)(...)`; otherwise the last identifier wins.
 */
function parseTypedef(stripped: string, declStart: number): DeclResult {
  const n = stripped.length;
  let i = declStart + 'typedef'.length;
  let kindWord: string | null = null;
  let bodyClose = -1;
  let semi = n;
  while (i < n) {
    const c = stripped[i];
    if (c === ';') {
      semi = i;
      break;
    }
    if (c === '{') {
      const close = matchBrace(stripped, i);
      if (bodyClose === -1) bodyClose = close;
      i = close + 1;
      continue;
    }
    if (c === '(') {
      i = matchParen(stripped, i) + 1;
      continue;
    }
    if (isWordChar(c) && !isWordChar(stripped[i - 1])) {
      const w = wordAt(stripped, i);
      if (w && kindWord === null && (w === 'struct' || w === 'enum' || w === 'union')) {
        kindWord = w;
      }
      i += w ? w.length : 1;
      continue;
    }
    i++;
  }
  if (semi === n) return { next: n, exp: null };

  const tailStart = bodyClose !== -1 ? bodyClose + 1 : declStart + 'typedef'.length;
  const tail = stripped.slice(tailStart, semi);
  const fp = /\(\s*\*+\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*\(/.exec(tail);
  let name: string | null = null;
  if (fp && fp[1] !== undefined) {
    name = fp[1];
  } else {
    const words = tail.match(/[A-Za-z_][A-Za-z0-9_]*/g);
    name = words && words.length > 0 ? (words[words.length - 1] ?? null) : null;
  }
  if (!name) return { next: semi + 1, exp: null };

  let kind: ExportKind = 'type';
  if (bodyClose !== -1 && kindWord === 'struct') kind = 'struct';
  else if (bodyClose !== -1 && kindWord === 'enum') kind = 'enum';
  return {
    next: semi + 1,
    exp: { name, kind, line: lineAt(stripped, declStart), endLine: lineAt(stripped, semi) },
  };
}

/**
 * `using Name = ...;` alias → `type` export. `using namespace ...;` and using
 * declarations (`using std::foo;`) are skipped.
 */
function parseUsing(stripped: string, declStart: number, kwPos: number): DeclResult {
  const p = skipWs(stripped, kwPos + 'using'.length);
  const word = wordAt(stripped, p);
  if (word === null || word === 'namespace') {
    return { next: skipStatement(stripped, p), exp: null };
  }
  const q = skipWs(stripped, p + word.length);
  if (stripped[q] !== '=') return { next: skipStatement(stripped, q), exp: null };
  const semi = findSemi(stripped, q);
  return {
    next: semi + 1,
    exp: {
      name: word,
      kind: 'type',
      line: lineAt(stripped, declStart),
      endLine: lineAt(stripped, semi),
    },
  };
}

/**
 * Free function — definition (`{...}`) or prototype (`;`). Requires a return
 * type before the name (a lone `NAME(...)` at file level is a macro call) and
 * skips qualified names (`void Foo::bar()` is a method definition, declared in
 * its class). `static` functions are kept only in headers.
 */
function parseFunction(
  stripped: string,
  declStart: number,
  from: number,
  isStatic: boolean,
  isHeader: boolean,
): DeclResult {
  const n = stripped.length;
  let scan = from;
  let lastWordStart = -1;
  let words = 0;
  let parenPos = -1;
  while (scan < n) {
    const c = stripped[scan];
    if (c === ';' || c === '=' || c === '{' || c === '}') break;
    if (c === '(') {
      parenPos = scan;
      break;
    }
    if (c === '<') {
      scan = matchAngle(stripped, scan) + 1;
      continue;
    }
    if (isWordChar(c) && !isWordChar(stripped[scan - 1])) {
      lastWordStart = scan;
      words++;
      const w = wordAt(stripped, scan);
      scan += w ? w.length : 1;
      continue;
    }
    scan++;
  }
  if (parenPos === -1 || lastWordStart === -1 || words < 2) {
    return { next: skipStatement(stripped, scan >= n ? from : scan), exp: null };
  }
  // out-of-class definition `void Foo::bar()` — skip
  if (stripped[lastWordStart - 1] === ':') {
    return { next: skipStatement(stripped, parenPos), exp: null };
  }
  const name = wordAt(stripped, lastWordStart);
  if (name === null) return { next: skipStatement(stripped, parenPos), exp: null };

  const close = matchParen(stripped, parenPos);
  let q = skipWs(stripped, close + 1);
  let trailingReturn: string | undefined;
  for (;;) {
    if (stripped[q] === '[' && stripped[q + 1] === '[') {
      q = skipWs(stripped, matchSquare(stripped, q) + 1);
      continue;
    }
    const w = wordAt(stripped, q);
    if (w && FN_TAIL_WORDS.has(w)) {
      q = skipWs(stripped, q + w.length);
      if (stripped[q] === '(') q = skipWs(stripped, matchParen(stripped, q) + 1);
      continue;
    }
    if (stripped[q] === '-' && stripped[q + 1] === '>') {
      let r = q + 2;
      while (r < n && stripped[r] !== '{' && stripped[r] !== ';') r++;
      trailingReturn = stripped.slice(q + 2, r).replace(/\s+/g, ' ').trim();
      q = r;
      continue;
    }
    break;
  }

  let endPos: number;
  if (stripped[q] === '{') endPos = matchBrace(stripped, q);
  else if (stripped[q] === ';') endPos = q;
  else return { next: skipStatement(stripped, q), exp: null };

  if (isStatic && !isHeader) return { next: endPos + 1, exp: null };

  const returnType =
    trailingReturn ?? stripped.slice(from, lastWordStart).replace(/\s+/g, ' ').trim();
  const signature: FunctionSignature = {
    parameters: parseCppParams(stripped.slice(parenPos + 1, close)),
  };
  if (returnType) signature.returnType = returnType;
  return {
    next: endPos + 1,
    exp: {
      name,
      kind: 'function',
      signature,
      line: lineAt(stripped, declStart),
      endLine: lineAt(stripped, endPos),
    },
  };
}

// ---------------------------------------------------------------------------
// Class bodies
// ---------------------------------------------------------------------------

/**
 * Walks the top level of a class/struct body and collects **public** methods
 * (incl. constructors). Tracks `public:`/`private:`/`protected:` sections —
 * `class` starts private, `struct` public. Destructors, `operator` overloads,
 * fields and nested types are skipped; bodies are never descended into.
 */
function parseClassBody(
  stripped: string,
  from: number,
  to: number,
  defaultPublic: boolean,
): MethodSignature[] {
  const methods: MethodSignature[] = [];
  let isPublic = defaultPublic;
  let i = from;
  while (i < to) {
    i = skipWs(stripped, i);
    if (i >= to) break;
    const c = stripped[i];
    if (c === ';') {
      i++;
      continue;
    }
    if (c === '{') {
      i = matchBrace(stripped, i) + 1;
      continue;
    }
    if (c === '[' && stripped[i + 1] === '[') {
      i = matchSquare(stripped, i) + 1;
      continue;
    }
    if (c === '~') {
      i = skipMember(stripped, i + 1, to);
      continue;
    }
    if (!isWordChar(c)) {
      i++;
      continue;
    }
    const word = wordAt(stripped, i);
    if (!word) {
      i++;
      continue;
    }

    if (word === 'public' || word === 'private' || word === 'protected') {
      const q = skipWs(stripped, i + word.length);
      if (stripped[q] === ':' && stripped[q + 1] !== ':') {
        isPublic = word === 'public';
        i = q + 1;
        continue;
      }
    }
    if (word === 'template') {
      let q = skipWs(stripped, i + word.length);
      if (stripped[q] === '<') q = matchAngle(stripped, q) + 1;
      i = q;
      continue;
    }
    if (
      word === 'using' ||
      word === 'typedef' ||
      word === 'friend' ||
      word === 'class' ||
      word === 'struct' ||
      word === 'enum' ||
      word === 'union'
    ) {
      i = skipMember(stripped, i, to);
      continue;
    }

    // member: modifiers, then a scan for `name(`
    let p = i;
    let isStatic = false;
    for (;;) {
      p = skipWs(stripped, p);
      if (stripped[p] === '[' && stripped[p + 1] === '[') {
        p = matchSquare(stripped, p) + 1;
        continue;
      }
      const w = wordAt(stripped, p);
      if (w === null) break;
      if (w === 'static') {
        isStatic = true;
        p += w.length;
        continue;
      }
      if (MEMBER_MODIFIERS.has(w)) {
        p += w.length;
        continue;
      }
      break;
    }
    let scan = p;
    let lastWordStart = -1;
    let parenPos = -1;
    let sawTilde = false;
    while (scan < to) {
      const ch = stripped[scan];
      if (ch === ';' || ch === '=' || ch === '{' || ch === '}') break;
      if (ch === '(') {
        parenPos = scan;
        break;
      }
      if (ch === '<') {
        scan = matchAngle(stripped, scan) + 1;
        continue;
      }
      if (ch === '~') {
        sawTilde = true;
        scan++;
        continue;
      }
      if (isWordChar(ch) && !isWordChar(stripped[scan - 1])) {
        lastWordStart = scan;
        const w = wordAt(stripped, scan);
        scan += w ? w.length : 1;
        continue;
      }
      scan++;
    }
    if (parenPos === -1 || lastWordStart === -1 || sawTilde) {
      i = skipMember(stripped, scan >= to ? p : scan, to);
      continue;
    }
    const name = wordAt(stripped, lastWordStart);
    if (!name || name === 'operator' || stripped[lastWordStart - 1] === ':') {
      i = skipMember(stripped, parenPos, to);
      continue;
    }
    const close = matchParen(stripped, parenPos);
    if (!isPublic) {
      i = skipMember(stripped, close + 1, to);
      continue;
    }
    const method: MethodSignature = {
      name,
      signature: { parameters: parseCppParams(stripped.slice(parenPos + 1, close)) },
    };
    if (isStatic) method.isStatic = true;
    methods.push(method);
    i = skipMember(stripped, close + 1, to);
  }
  return methods;
}

/**
 * Skips one class member from `pos`: ends after `;` (field, prototype, pure
 * virtual `= 0;`) or after a `{...}` body, whichever comes first. `(...)`
 * groups are skipped; a stray `}` (body end) stops the scan in place.
 */
function skipMember(stripped: string, pos: number, to: number): number {
  let i = pos;
  while (i < to) {
    const c = stripped[i];
    if (c === ';') return i + 1;
    if (c === '{') return matchBrace(stripped, i) + 1;
    if (c === '}') return i;
    if (c === '(') {
      i = matchParen(stripped, i) + 1;
      continue;
    }
    i++;
  }
  return to;
}

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/**
 * C/C++ parameter list. Each parameter is `type name` with the name as the
 * last identifier (`const std::string& name`, `char *argv[]`); a lone type
 * (`int`, `Widget&`) maps to name `_`. A `void` list and `...` varargs are
 * handled, `= default` values set `optional`, function pointers
 * (`int (*cb)(int)`) take the name from inside the parentheses.
 */
function parseCppParams(paramsStr: string): Parameter[] {
  const result: Parameter[] = [];
  for (const raw of splitTopLevelCommas(paramsStr)) {
    let s = raw.trim();
    if (!s || s === 'void') continue;
    if (s === '...') {
      result.push({ name: '...', rest: true });
      continue;
    }

    let optional = false;
    const eq = s.indexOf('=');
    if (eq !== -1) {
      optional = true;
      s = s.slice(0, eq).trim();
    }

    // function pointer: `ret (*name)(args)`
    const fp = /^(.+?)\(\s*\*+\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*(\([^)]*\))\s*$/.exec(s);
    if (fp && fp[1] !== undefined && fp[2] !== undefined && fp[3] !== undefined) {
      const param: Parameter = {
        name: fp[2],
        type: `${fp[1].trim()} (*)${fp[3]}`.replace(/\s+/g, ' '),
      };
      if (optional) param.optional = true;
      result.push(param);
      continue;
    }

    // trailing array suffixes `[]` / `[10]` belong to the type
    let arr = '';
    const am = /^(.*?)\s*((?:\[[^\]]*\])+)$/.exec(s);
    if (am && am[1] !== undefined && am[2] !== undefined) {
      s = am[1];
      arr = am[2];
    }

    const m = /^(.*?[^A-Za-z0-9_])\s*([A-Za-z_][A-Za-z0-9_]*)$/.exec(s);
    if (m && m[1] !== undefined && m[2] !== undefined) {
      const param: Parameter = {
        name: m[2],
        type: (m[1].trim() + arr).replace(/\s+/g, ' '),
      };
      if (optional) param.optional = true;
      result.push(param);
    } else {
      const param: Parameter = { name: '_', type: (s + arr).replace(/\s+/g, ' ') };
      if (optional) param.optional = true;
      result.push(param);
    }
  }
  return result;
}
