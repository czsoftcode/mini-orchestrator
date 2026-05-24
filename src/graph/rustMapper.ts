import type {
  ExportInfo,
  FileGraph,
  FunctionSignature,
  ImportInfo,
  Parameter,
} from './types.js';

/**
 * Regex-based Rust mapper. Smaže komentáře (včetně vnořených block-komentářů,
 * které Rust podporuje), stringy (běžné, raw `r"..."`/`r#"..."#`, byte/c
 * prefixy) a char literály — vše nahrazením mezerami stejné délky, aby
 * brace-counting zůstal věrný originálu. Pak hledá top-level `use ...;` a
 * `pub [(...)] fn|struct|enum|trait Name`.
 *
 * Záměrně konzervativní: `pub` deklarace uvnitř `impl` bloků ani uvnitř modulů
 * (`mod foo { pub fn ... }`) se nemapují — pro mapu cílíme jen na crate-level
 * symboly, ke kterým se z venku reálně sahá.
 */
export function mapRustFile(content: string, relPath: string): FileGraph {
  const stripped = stripRustCommentsAndStrings(content);
  const imports = extractRustImports(stripped);
  const exports = extractRustExports(stripped);
  return {
    path: relPath.replace(/\\/g, '/'),
    exports,
    imports,
  };
}

function stripRustCommentsAndStrings(content: string): string {
  const out: string[] = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === undefined) break;
    const c2 = content[i + 1];

    // block /* ... */ — Rust dovoluje vnoření
    if (c === '/' && c2 === '*') {
      let depth = 1;
      out.push(' ');
      out.push(' ');
      let j = i + 2;
      while (j < n && depth > 0) {
        if (content[j] === '/' && content[j + 1] === '*') {
          depth++;
          out.push(' ');
          out.push(' ');
          j += 2;
        } else if (content[j] === '*' && content[j + 1] === '/') {
          depth--;
          out.push(' ');
          out.push(' ');
          j += 2;
        } else {
          out.push(content[j] === '\n' ? '\n' : ' ');
          j++;
        }
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

    // raw string r"..." | r#"..."# | r##"..."## | br"..." | br#"..."# | cr"..."
    if (
      (c === 'r' || ((c === 'b' || c === 'c') && c2 === 'r')) &&
      isRawStringStart(content, i)
    ) {
      const consumed = consumeRawString(content, i);
      for (let k = i; k < i + consumed; k++) out.push(content[k] === '\n' ? '\n' : ' ');
      i += consumed;
      continue;
    }

    // byte string b"..." nebo c string c"..."
    if ((c === 'b' || c === 'c') && c2 === '"') {
      const consumed = consumeQuotedString(content, i + 1) + 1;
      for (let k = i; k < i + consumed; k++) out.push(content[k] === '\n' ? '\n' : ' ');
      i += consumed;
      continue;
    }

    // běžný řetězec "..."
    if (c === '"') {
      const consumed = consumeQuotedString(content, i);
      for (let k = i; k < i + consumed; k++) out.push(content[k] === '\n' ? '\n' : ' ');
      i += consumed;
      continue;
    }

    // char literál 'X' nebo '\X' — pozor na lifetime 'a (bez uzavírací ').
    if (c === "'") {
      const charMatch = /^'(?:\\(?:x[0-9A-Fa-f]{2}|u\{[0-9A-Fa-f]+\}|.)|[^'\\])'/.exec(content.slice(i));
      if (charMatch) {
        for (let k = 0; k < charMatch[0].length; k++) out.push(' ');
        i += charMatch[0].length;
        continue;
      }
      // jinak lifetime — necháme být
    }

    out.push(c);
    i++;
  }
  return out.join('');
}

function isRawStringStart(content: string, pos: number): boolean {
  let i = pos;
  // přeskoč případné prefixy br / cr / r
  if ((content[i] === 'b' || content[i] === 'c') && content[i + 1] === 'r') i += 2;
  else if (content[i] === 'r') i += 1;
  else return false;
  while (content[i] === '#') i++;
  return content[i] === '"';
}

function consumeRawString(content: string, pos: number): number {
  let i = pos;
  if ((content[i] === 'b' || content[i] === 'c') && content[i + 1] === 'r') i += 2;
  else i += 1; // jen 'r'
  let hashes = 0;
  while (content[i] === '#') {
    hashes++;
    i++;
  }
  if (content[i] !== '"') return i - pos;
  i++;
  const close = '"' + '#'.repeat(hashes);
  while (i < content.length) {
    if (content.slice(i, i + close.length) === close) {
      i += close.length;
      return i - pos;
    }
    i++;
  }
  return content.length - pos;
}

function consumeQuotedString(content: string, pos: number): number {
  if (content[pos] !== '"') return 0;
  let i = pos + 1;
  while (i < content.length) {
    if (content[i] === '\\' && i + 1 < content.length) {
      i += 2;
      continue;
    }
    if (content[i] === '"') {
      i++;
      return i - pos;
    }
    i++;
  }
  return content.length - pos;
}

function depthAt(stripped: string, position: number): number {
  let depth = 0;
  for (let i = 0; i < position; i++) {
    const c = stripped[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return depth;
}

function matchParen(stripped: string, openPos: number): number {
  let depth = 0;
  for (let i = openPos; i < stripped.length; i++) {
    if (stripped[i] === '(') depth++;
    else if (stripped[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return stripped.length;
}

function matchAngle(stripped: string, openPos: number): number {
  let depth = 0;
  for (let i = openPos; i < stripped.length; i++) {
    if (stripped[i] === '<') depth++;
    else if (stripped[i] === '>') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return stripped.length;
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

function extractRustImports(stripped: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  // Match `use ...;` (i `pub use`, `pub(crate) use`).
  const regex = /\buse\s+([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stripped)) !== null) {
    if (depthAt(stripped, m.index) !== 0) continue;
    const body = m[1];
    if (body === undefined) continue;
    parseRustUseBody(body.trim(), imports);
  }
  return imports;
}

function parseRustUseBody(body: string, out: ImportInfo[]): void {
  // Group form: prefix::{ ... }
  const groupMatch = /^(.+?)::\{([\s\S]*)\}$/.exec(body);
  if (groupMatch && groupMatch[1] !== undefined && groupMatch[2] !== undefined) {
    const prefix = groupMatch[1].trim();
    const inner = groupMatch[2];
    const symbols: string[] = [];
    for (const item of splitTopLevelCommas(inner)) {
      if (item === 'self') {
        const segments = prefix.split('::');
        const name = segments[segments.length - 1];
        if (name) symbols.push(name);
        continue;
      }
      if (item === '*') {
        symbols.push('*');
        continue;
      }
      const asMatch = /^(.+?)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(item);
      if (asMatch && asMatch[2] !== undefined) {
        symbols.push(asMatch[2]);
        continue;
      }
      const segments = item.split('::');
      const name = segments[segments.length - 1];
      if (name) symbols.push(name);
    }
    if (symbols.length > 0) out.push({ source: prefix, symbols });
    return;
  }

  // Glob: foo::bar::*
  const globMatch = /^(.+?)::\*$/.exec(body);
  if (globMatch && globMatch[1] !== undefined) {
    out.push({ source: globMatch[1].trim(), symbols: ['*'] });
    return;
  }

  // Simple [as Alias]
  const asMatch = /^(.+?)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(body);
  if (asMatch && asMatch[1] !== undefined && asMatch[2] !== undefined) {
    out.push({ source: asMatch[1].trim(), symbols: [asMatch[2]] });
    return;
  }

  const segments = body.split('::').map((s) => s.trim());
  const name = segments[segments.length - 1];
  if (!name) return;
  out.push({ source: body, symbols: [name] });
}

function extractRustExports(stripped: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  // `pub` nebo `pub(crate|super|in path)` následované klíčovým slovem.
  const regex = /\bpub(?:\s*\([^)]*\))?\s+(fn|struct|enum|trait)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(stripped)) !== null) {
    if (depthAt(stripped, m.index) !== 0) continue;
    const kind = m[1];
    const name = m[2];
    if (!kind || !name) continue;
    if (kind === 'fn') {
      const sig = parseRustFnAfterName(stripped, m.index + m[0].length);
      exports.push({ name, kind: 'function', signature: sig });
    } else if (kind === 'struct') {
      exports.push({ name, kind: 'struct' });
    } else if (kind === 'enum') {
      exports.push({ name, kind: 'enum' });
    } else if (kind === 'trait') {
      exports.push({ name, kind: 'trait' });
    }
  }
  return exports;
}

function parseRustFnAfterName(stripped: string, fromPos: number): FunctionSignature {
  let p = fromPos;
  // přeskoč whitespace
  while (p < stripped.length && isWhitespace(stripped[p])) p++;
  // generics <...>
  if (stripped[p] === '<') {
    p = matchAngle(stripped, p) + 1;
  }
  while (p < stripped.length && isWhitespace(stripped[p])) p++;
  if (stripped[p] !== '(') return { parameters: [] };
  const close = matchParen(stripped, p);
  const paramsStr = stripped.slice(p + 1, close);
  const parameters: Parameter[] = [];
  for (const raw of splitTopLevelCommas(paramsStr)) {
    const part = raw.trim();
    if (!part) continue;
    // self varianty — vynech (pro top-level `pub fn` se neobjeví, ale buďme robustní)
    if (part === 'self' || part === '&self' || part === '&mut self' || part === 'mut self') continue;
    const m = /^(?:mut\s+)?(?:_|([A-Za-z_][A-Za-z0-9_]*))\s*:\s*(.+)$/.exec(part);
    if (m) {
      const name = m[1] ?? '_';
      const type = (m[2] ?? '').trim();
      parameters.push({ name, type });
      continue;
    }
    parameters.push({ name: '_', type: part });
  }
  const sig: FunctionSignature = { parameters };
  // návratový typ
  const after = stripped.slice(close + 1);
  const retMatch = /^\s*->\s*([^{;]+?)(?:\s*where\b|\s*\{|\s*;|$)/.exec(after);
  if (retMatch && retMatch[1] !== undefined) sig.returnType = retMatch[1].trim();
  return sig;
}

function isWhitespace(c: string | undefined): boolean {
  if (c === undefined) return false;
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}
