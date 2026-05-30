import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, sep } from 'node:path';
import { isGitRepo, runGit } from '../git.js';
import { mapFile } from './mapper.js';
import { mapCSharpFile } from './csharpMapper.js';
import { mapGoFile } from './goMapper.js';
import { mapJavaFile } from './javaMapper.js';
import { mapKotlinFile } from './kotlinMapper.js';
import { mapPhpFile } from './phpMapper.js';
import { mapPythonFile } from './pythonMapper.js';
import { mapRustFile } from './rustMapper.js';
import { mapSwiftFile } from './swiftMapper.js';
import type { ExportInfo, FileGraph, ImportInfo } from './types.js';

/** Adresář s per-file mapami (jeden markdown na zdrojový soubor). */
export const GRAPH_DIR = '.mini/graph';
/** Lehký index: cesta zdrojáku → cesta v `GRAPH_DIR` + názvy exportů. */
export const GRAPH_INDEX = '.mini/graph.json';
/** Starý monolitický soubor — po přechodu na nový layout ho mažeme. */
export const LEGACY_GRAPH_FILE = '.mini/graph.md';

/** Verze formátu indexu `graph.json`. */
export const GRAPH_INDEX_VERSION = 1;

/**
 * Adresáře, do kterých nelezeme při `walk` fallbacku — runtime/build artefakty,
 * VCS interní data, mini vlastní metadata. **Fallback path**: v git repu se
 * rozsah řídí výhradně `.gitignore` přes `git ls-files` (viz `collectFromGit`),
 * takže tenhle seznam platí jen mimo git repo / když git binárka chybí. Drž ho
 * proto konzervativní — má pokrýt to nejhorší (`node_modules`, `dist`, …) i bez
 * gitu.
 *
 * `vendor/` (Composer) a `target/` (Cargo) jsou tu kvůli PHP a Rust projektům,
 * `.venv/` a `__pycache__/` kvůli Pythonu — generované balíčky/buildy/cache nikdo
 * nechce v grafu.
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
  'vendor',
  'target',
  '.venv',
  '__pycache__',
]);

type Lang = 'ts' | 'php' | 'rust' | 'python' | 'go' | 'java' | 'csharp' | 'kotlin' | 'swift';

/** Jeden záznam v indexu `graph.json`. */
export interface GraphIndexEntry {
  /** Cesta zdrojáku relativní ke kořeni projektu (vždy s `/`). */
  path: string;
  /** Cesta k per-file mapě relativní ke kořeni projektu (vždy s `/`). */
  graphFile: string;
  /** Názvy exportů — vodítko, podle čeho vybrat, který soubor otevřít. */
  exports: string[];
}

/** Strojová podoba indexu zapsaná do `graph.json`. */
export interface GraphIndex {
  version: number;
  generatedAt: string;
  files: GraphIndexEntry[];
}

export interface BuildGraphResult {
  /** Cesta k zapsanému indexu `.mini/graph.json` (relativní k `cwd`). */
  indexFile: string;
  /** Cesta k adresáři s per-file mapami `.mini/graph` (relativní k `cwd`). */
  graphDir: string;
  /** Počet souborů (TS/TSX/PHP/Rust/Python/Go), ze kterých se mapa sestavila. */
  fileCount: number;
  /** Strojová podoba grafu (pro testy / další zpracování). */
  files: FileGraph[];
}

export interface BuildGraphOptions {
  /** Custom predikát pro filtrování souborů (mimo defaultní přípony). */
  includeFile?: (relPath: string) => boolean;
}

/**
 * Najde všechny mapovatelné soubory v `cwd` (TS/TSX, PHP, Rust, Python, Go), namapuje je
 * a uloží do adresáře `.mini/graph/` (jeden markdown na zdrojový soubor,
 * zrcadlí strom zdrojáků) + lehký index `.mini/graph.json`. Žádný stav
 * v `state.json` — graf je čistě derivace ze zdrojáků.
 *
 * Zápis je atomický: nejdřív se vše vyrobí v `.mini/graph.tmp/` + dočasném
 * indexu, pak se starý adresář nahradí a starý monolitický `.mini/graph.md`
 * (pokud zbyl) smaže.
 */
export async function buildGraph(
  cwd: string = process.cwd(),
  options: BuildGraphOptions = {},
): Promise<BuildGraphResult> {
  const files = await collectFiles(cwd, options);

  const graphs: FileGraph[] = [];
  for (const { relPath, lang } of files) {
    try {
      const content = await readFile(join(cwd, relPath), 'utf-8');
      graphs.push(mapByLang(content, relPath, lang));
    } catch {
      // Soubor mohl zmizet mezi readdir a readFile (build artifact, race) —
      // přeskočíme, graf je best-effort snapshot.
    }
  }

  graphs.sort((a, b) => a.path.localeCompare(b.path));

  await writeGraphLayout(cwd, graphs);

  return { indexFile: GRAPH_INDEX, graphDir: GRAPH_DIR, fileCount: graphs.length, files: graphs };
}

/**
 * Zapíše per-file mapy + index atomicky. Strategie: vyrobit kompletní layout
 * v `.mini/graph.tmp/` a `.mini/graph.json.tmp`, pak prohodit (`rename` je
 * atomický per-cesta). Plný rebuild při každém volání znamená, že stačí
 * adresář celý nahradit — žádné osiřelé soubory po smazaných zdrojácích.
 */
async function writeGraphLayout(cwd: string, graphs: FileGraph[]): Promise<void> {
  const miniDir = join(cwd, '.mini');
  await mkdir(miniDir, { recursive: true });

  const dirAbs = join(cwd, GRAPH_DIR);
  const tmpDirAbs = `${dirAbs}.tmp`;
  const indexAbs = join(cwd, GRAPH_INDEX);
  const tmpIndexAbs = `${indexAbs}.tmp`;

  // Čistý start tmp adresáře (kdyby zbyl po dřívějším pádu).
  await rm(tmpDirAbs, { recursive: true, force: true });
  await mkdir(tmpDirAbs, { recursive: true });

  const entries: GraphIndexEntry[] = [];
  for (const file of graphs) {
    const graphFileRel = posix.join(GRAPH_DIR, `${file.path}.md`);
    const graphFileAbs = join(cwd, graphFileRel);
    const tmpFileAbs = join(tmpDirAbs, `${file.path}.md`);
    await mkdir(dirname(tmpFileAbs), { recursive: true });
    await writeFile(tmpFileAbs, renderFileGraph(file), 'utf-8');
    entries.push({
      path: file.path,
      graphFile: toUnix(relative(cwd, graphFileAbs)),
      exports: file.exports.map((e) => e.name),
    });
  }

  const index: GraphIndex = {
    version: GRAPH_INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    files: entries,
  };
  await writeFile(tmpIndexAbs, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');

  // Swap: starý adresář pryč, tmp na jeho místo; pak index; pak legacy soubor.
  await rm(dirAbs, { recursive: true, force: true });
  await rename(tmpDirAbs, dirAbs);
  await rename(tmpIndexAbs, indexAbs);
  await rm(join(cwd, LEGACY_GRAPH_FILE), { force: true });
}

function mapByLang(content: string, relPath: string, lang: Lang): FileGraph {
  switch (lang) {
    case 'ts':
      return mapFile(content, relPath);
    case 'php':
      return mapPhpFile(content, relPath);
    case 'rust':
      return mapRustFile(content, relPath);
    case 'python':
      return mapPythonFile(content, relPath);
    case 'go':
      return mapGoFile(content, relPath);
    case 'java':
      return mapJavaFile(content, relPath);
    case 'csharp':
      return mapCSharpFile(content, relPath);
    case 'kotlin':
      return mapKotlinFile(content, relPath);
    case 'swift':
      return mapSwiftFile(content, relPath);
  }
}

/**
 * Detekuje, jestli má smysl spouštět vlastní mapper: hledá `tsconfig.json`,
 * `Cargo.toml`, `composer.json`, `pyproject.toml`, `setup.py`, `go.mod`,
 * `pom.xml`, `build.gradle`(`.kts` = i Kotlin), `Package.swift`, C#
 * `*.sln`/`*.csproj` nebo alespoň jeden mapovatelný soubor
 * (.ts/.tsx/.php/.rs/.py/.go/.java/.cs/.kt/.kts/.swift) v projektu (mimo
 * ignorované adresáře).
 */
export async function hasMappableProject(cwd: string = process.cwd()): Promise<boolean> {
  if (await fileExists(join(cwd, 'tsconfig.json'))) return true;
  if (await fileExists(join(cwd, 'Cargo.toml'))) return true;
  if (await fileExists(join(cwd, 'composer.json'))) return true;
  if (await fileExists(join(cwd, 'pyproject.toml'))) return true;
  if (await fileExists(join(cwd, 'setup.py'))) return true;
  if (await fileExists(join(cwd, 'go.mod'))) return true;
  if (await fileExists(join(cwd, 'pom.xml'))) return true;
  if (await fileExists(join(cwd, 'build.gradle'))) return true;
  if (await fileExists(join(cwd, 'build.gradle.kts'))) return true;
  if (await fileExists(join(cwd, 'Package.swift'))) return true;
  // C#: název `*.sln`/`*.csproj` je variabilní → koukneme po příponě v kořeni.
  if (await hasFileWithExt(cwd, ['.sln', '.csproj'])) return true;
  const files = await collectMappableFiles(cwd, {}, /* stopAfter */ 1);
  return files.length > 0;
}

/** True, když v kořeni `cwd` leží soubor s některou z přípon `exts`. */
async function hasFileWithExt(cwd: string, exts: string[]): Promise<boolean> {
  let entries;
  try {
    entries = await readdir(cwd, { withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some((e) => e.isFile() && exts.some((ext) => e.name.endsWith(ext)));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface MappableFile {
  relPath: string;
  lang: Lang;
}

/**
 * Vybere zdroj seznamu souborů: v git repu se ptáme gitu (respektuje `.gitignore`,
 * vnořené `.gitignore`, negace i globální excludes), jinak prohledáme strom sami
 * přes `walk` + `IGNORE_DIRS`. Když git z jakéhokoli důvodu selže (chybí binárka,
 * porušený repo), spadneme zpět na `walk`.
 */
async function collectFiles(cwd: string, options: BuildGraphOptions): Promise<MappableFile[]> {
  if (await isGitRepo(cwd)) {
    const fromGit = await collectFromGit(cwd, options);
    if (fromGit) return fromGit;
  }
  return collectMappableFiles(cwd, options);
}

/**
 * Seznam mapovatelných souborů z gitu: `git ls-files -co --exclude-standard -z`
 * vrátí tracked + untracked-ne-ignorované soubory (NUL-separované, cesty s `/`
 * relativní ke `cwd`). Tím se ignorované runtime/build artefakty (`var/cache`,
 * `dist`, …) vůbec nezpracují. Vrací `null`, když git příkaz selže — volající
 * pak použije `walk` fallback.
 */
async function collectFromGit(
  cwd: string,
  options: BuildGraphOptions,
): Promise<MappableFile[] | null> {
  const r = await runGit(['ls-files', '-co', '--exclude-standard', '-z'], cwd);
  if (!r.ok) return null;

  const matches: MappableFile[] = [];
  for (const rel of r.stdout.split('\0')) {
    if (rel.length === 0) continue; // trailing NUL / prázdné řádky
    const lang = detectLang(rel);
    if (!lang) continue;
    if (options.includeFile && !options.includeFile(rel)) continue;
    matches.push({ relPath: rel, lang });
  }
  return matches;
}

async function collectMappableFiles(
  cwd: string,
  options: BuildGraphOptions,
  stopAfter?: number,
): Promise<MappableFile[]> {
  const matches: MappableFile[] = [];
  await walk(cwd, cwd, matches, options, stopAfter);
  return matches;
}

async function walk(
  rootDir: string,
  currentDir: string,
  matches: MappableFile[],
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
    const lang = detectLang(entry.name);
    if (!lang) continue;
    const rel = toUnix(relative(rootDir, full));
    if (options.includeFile && !options.includeFile(rel)) continue;
    matches.push({ relPath: rel, lang });
    if (stopAfter !== undefined && matches.length >= stopAfter) return;
  }
}

function detectLang(name: string): Lang | null {
  if (name.endsWith('.d.ts')) return null;
  if (
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.js') ||
    name.endsWith('.jsx') ||
    name.endsWith('.mjs') ||
    name.endsWith('.cjs')
  ) {
    return 'ts';
  }
  if (name.endsWith('.php')) return 'php';
  if (name.endsWith('.rs')) return 'rust';
  if (name.endsWith('.py') || name.endsWith('.pyi')) return 'python';
  if (name.endsWith('.go')) return 'go';
  if (name.endsWith('.java')) return 'java';
  if (name.endsWith('.cs')) return 'csharp';
  if (name.endsWith('.kt') || name.endsWith('.kts')) return 'kotlin';
  if (name.endsWith('.swift')) return 'swift';
  return null;
}

function toUnix(p: string): string {
  if (sep === '/') return p;
  return p.split(sep).join(posix.sep);
}

/**
 * Vyrenderuje mapu **jednoho** souboru do kompaktního markdownu: `## cesta`
 * hlavička + imports / exports / metody jako bullety. Záměrně bez fenced kódu,
 * ať Claude může do toho zaměřovat search/grep bez markdown escape obtíží.
 * Jeden takový blok = obsah jednoho `.mini/graph/<cesta>.md`.
 */
export function renderFileGraph(file: FileGraph): string {
  const lines: string[] = [];
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
  const loc = lineSuffix(exp);
  if (exp.kind === 'function' && exp.signature) {
    lines.push(`- function ${exp.name}${renderSignature(exp.signature)}${defaultMark}${loc}`);
    return lines;
  }
  lines.push(`- ${exp.kind} ${exp.name}${defaultMark}${loc}`);
  // Metody: class (TS/PHP) i struct/interface (Go přes receiver) je můžou mít.
  for (const method of exp.methods ?? []) {
    const staticMark = method.isStatic ? 'static ' : '';
    lines.push(`  - ${staticMark}${method.name}${renderSignature(method.signature)}`);
  }
  return lines;
}

/**
 * Kotva na řádky zdrojáku: ` @L<start>-<end>` pro víceřádkové deklarace,
 * ` @L<start>` pro jednořádkové (nebo když konec není znám). Když mapper řádek
 * neurčil (`line` chybí), nepřidá nic. Slouží agentovi k cílenému `Read`
 * (`offset` = start, `limit` = end − start + 1).
 */
function lineSuffix(exp: ExportInfo): string {
  if (exp.line === undefined) return '';
  if (exp.endLine !== undefined && exp.endLine > exp.line) {
    return ` @L${exp.line}-${exp.endLine}`;
  }
  return ` @L${exp.line}`;
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
