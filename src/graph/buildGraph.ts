import { access, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { mapFile } from './mapper.js';
import type { ExportInfo, FileGraph, ImportInfo } from './types.js';

export const GRAPH_FILE = '.mini/graph.md';

/**
 * Adresáře, do kterých nikdy nelezeme — runtime/build artefakty, VCS interní
 * data, mini vlastní metadata. Záměrně netaháme z .gitignore (jiný projekt mohl
 * ignorovat věci, které pro graf chceme), drž tu konzervativní whitelist.
 */
const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.mini',
  '.planning',
  '.next',
  '.turbo',
  '.cache',
  '.svelte-kit',
  '.nuxt',
  '.output',
  'coverage',
  '.vercel',
  'out',
]);

export interface BuildGraphResult {
  /** Cesta k zapsanému `.mini/graph.md` (relativní k `cwd`). */
  graphFile: string;
  /** Počet TS/TSX souborů, ze kterých se mapa sestavila. */
  fileCount: number;
  /** Strojová podoba grafu (pro testy / další zpracování). */
  files: FileGraph[];
}

export interface BuildGraphOptions {
  /** Custom predikát pro filtrování souborů (mimo .ts/.tsx default). */
  includeFile?: (relPath: string) => boolean;
}

/**
 * Najde všechny TS/TSX soubory v `cwd`, namapuje je a uloží markdown přehled
 * do `.mini/graph.md`. Žádný stav v `state.json` — graf je čistě derivace ze
 * zdrojáků.
 */
export async function buildGraph(
  cwd: string = process.cwd(),
  options: BuildGraphOptions = {},
): Promise<BuildGraphResult> {
  const files = await collectTsFiles(cwd, options);

  const graphs: FileGraph[] = [];
  for (const relPath of files) {
    try {
      const content = await readFile(join(cwd, relPath), 'utf-8');
      graphs.push(mapFile(content, relPath));
    } catch {
      // Soubor mohl zmizet mezi readdir a readFile (build artifact, race) —
      // přeskočíme, graf je best-effort snapshot.
    }
  }

  graphs.sort((a, b) => a.path.localeCompare(b.path));

  const markdown = renderGraphMarkdown(graphs);
  const graphFileAbs = join(cwd, GRAPH_FILE);
  await mkdir(join(cwd, '.mini'), { recursive: true });
  const tmp = `${graphFileAbs}.tmp`;
  await writeFile(tmp, markdown, 'utf-8');
  await rename(tmp, graphFileAbs);

  return { graphFile: GRAPH_FILE, fileCount: graphs.length, files: graphs };
}

/**
 * Detekuje, jestli má smysl spouštět vlastní TS mapper: hledá `tsconfig.json`
 * nebo alespoň jeden `.ts`/`.tsx` soubor v projektu (mimo ignorované adresáře).
 */
export async function isTypeScriptProject(cwd: string = process.cwd()): Promise<boolean> {
  if (await fileExists(join(cwd, 'tsconfig.json'))) return true;
  // Bez tsconfig se podíváme, jestli vůbec nějaký TS soubor existuje.
  const files = await collectTsFiles(cwd, {}, /* stopAfter */ 1);
  return files.length > 0;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectTsFiles(
  cwd: string,
  options: BuildGraphOptions,
  stopAfter?: number,
): Promise<string[]> {
  const matches: string[] = [];
  await walk(cwd, cwd, matches, options, stopAfter);
  return matches;
}

async function walk(
  rootDir: string,
  currentDir: string,
  matches: string[],
  options: BuildGraphOptions,
  stopAfter?: number,
): Promise<void> {
  if (stopAfter !== undefined && matches.length >= stopAfter) return;

  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  // sort, aby výstup byl deterministický (i když mapování později sort znovu)
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '..') {
      // Skryté soubory ignoruj (pokud nejsou explicitně v IGNORE_DIRS — pak by je
      // beztak filtr níž zachytil)
      if (IGNORE_DIRS.has(entry.name)) continue;
      // Skryté soubory typu `.eslintrc.ts` jsou raritní; zachováme je jen pro
      // adresáře, které explicitně NEignorujeme. Default: skip skryté.
      if (entry.isDirectory()) continue;
    }
    const full = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await walk(rootDir, full, matches, options, stopAfter);
      if (stopAfter !== undefined && matches.length >= stopAfter) return;
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isTsFile(entry.name)) continue;
    const rel = toUnix(relative(rootDir, full));
    if (options.includeFile && !options.includeFile(rel)) continue;
    matches.push(rel);
    if (stopAfter !== undefined && matches.length >= stopAfter) return;
  }
}

function isTsFile(name: string): boolean {
  if (!name.endsWith('.ts') && !name.endsWith('.tsx')) return false;
  if (name.endsWith('.d.ts')) return false;
  return true;
}

function toUnix(p: string): string {
  if (sep === '/') return p;
  return p.split(sep).join(posix.sep);
}

/**
 * Vyrenderuje graf do kompaktního markdown přehledu. Jeden soubor = jedna `##`
 * sekce; imports / exports / metody jako bullety. Záměrně bez fenced kódu, ať
 * Claude může do toho zaměřovat search/grep bez markdown escape obtíží.
 */
export function renderGraphMarkdown(files: FileGraph[]): string {
  const lines: string[] = [];
  lines.push('# Graf projektu');
  lines.push('');
  lines.push(
    'Strojově generovaný přehled TS/TSX souborů (exporty, importy, signatury). Neupravuj ručně — `mini map` ho přegeneruje.',
  );
  lines.push('');
  if (files.length === 0) {
    lines.push('_(žádné TS/TSX soubory)_');
    lines.push('');
    return lines.join('\n');
  }
  for (const file of files) {
    lines.push(`## ${file.path}`);
    lines.push('');
    if (file.imports.length > 0) {
      lines.push('Imports:');
      for (const imp of file.imports) {
        lines.push(`- ${renderImport(imp)}`);
      }
      lines.push('');
    }
    if (file.exports.length > 0) {
      lines.push('Exports:');
      for (const exp of file.exports) {
        for (const line of renderExport(exp)) {
          lines.push(line);
        }
      }
      lines.push('');
    }
    if (file.imports.length === 0 && file.exports.length === 0) {
      lines.push('_(žádné exporty ani importy)_');
      lines.push('');
    }
  }
  return lines.join('\n');
}

function renderImport(imp: ImportInfo): string {
  const prefix = imp.typeOnly ? 'type ' : '';
  if (imp.symbols.length === 0) return `${prefix}side-effect "${imp.source}"`;
  const symbols = imp.symbols.join(', ');
  return `${prefix}{ ${symbols} } from "${imp.source}"`;
}

function renderExport(exp: ExportInfo): string[] {
  const lines: string[] = [];
  const defaultMark = exp.isDefault ? ' (default)' : '';
  if (exp.kind === 'function' && exp.signature) {
    lines.push(`- function ${exp.name}${renderSignature(exp.signature)}${defaultMark}`);
    return lines;
  }
  if (exp.kind === 'class') {
    lines.push(`- class ${exp.name}${defaultMark}`);
    for (const method of exp.methods ?? []) {
      const staticMark = method.isStatic ? 'static ' : '';
      lines.push(`  - ${staticMark}${method.name}${renderSignature(method.signature)}`);
    }
    return lines;
  }
  lines.push(`- ${exp.kind} ${exp.name}${defaultMark}`);
  return lines;
}

function renderSignature(sig: { parameters: { name: string; type?: string; optional?: boolean; rest?: boolean }[]; returnType?: string }): string {
  const params = sig.parameters
    .map((p) => {
      const rest = p.rest ? '...' : '';
      const opt = p.optional ? '?' : '';
      const type = p.type ? `: ${p.type}` : '';
      return `${rest}${p.name}${opt}${type}`;
    })
    .join(', ');
  const ret = sig.returnType ? `: ${sig.returnType}` : '';
  return `(${params})${ret}`;
}
