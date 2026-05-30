import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { isGitRepo, runGit } from '../git.js';
import { mapFile } from './mapper.js';
import { mapCSharpFile } from './csharpMapper.js';
import { mapGoFile } from './goMapper.js';
import { mapJavaFile } from './javaMapper.js';
import { mapKotlinFile } from './kotlinMapper.js';
import { mapPhpFile } from './phpMapper.js';
import { mapPythonFile } from './pythonMapper.js';
import { mapRubyFile } from './rubyMapper.js';
import { mapRustFile } from './rustMapper.js';
import { mapSwiftFile } from './swiftMapper.js';
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
export async function buildGraph(cwd = process.cwd(), options = {}) {
    const files = await collectFiles(cwd, options);
    const graphs = [];
    for (const { relPath, lang } of files) {
        try {
            const content = await readFile(join(cwd, relPath), 'utf-8');
            graphs.push(mapByLang(content, relPath, lang));
        }
        catch {
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
async function writeGraphLayout(cwd, graphs) {
    const miniDir = join(cwd, '.mini');
    await mkdir(miniDir, { recursive: true });
    const dirAbs = join(cwd, GRAPH_DIR);
    const tmpDirAbs = `${dirAbs}.tmp`;
    const indexAbs = join(cwd, GRAPH_INDEX);
    const tmpIndexAbs = `${indexAbs}.tmp`;
    // Čistý start tmp adresáře (kdyby zbyl po dřívějším pádu).
    await rm(tmpDirAbs, { recursive: true, force: true });
    await mkdir(tmpDirAbs, { recursive: true });
    const entries = [];
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
    const index = {
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
/**
 * Inkrementálně přemapuje **jeden** soubor: přepíše jeho uzel
 * `.mini/graph/<cesta>.md` a upsertne odpovídající záznam v `.mini/graph.json`
 * se zachováním `localeCompare` pořadí (+ bump `generatedAt`). Zápisy jsou
 * atomické přes tmp + `rename`. Protože uzly grafu jsou čistě per-file (žádné
 * zpětné hrany), výsledek je identický s plným rebuildem dotčeného souboru.
 *
 * Hot path pro autonomní režim (hook po Edit/Write). Plný `buildGraph` zůstává
 * fallback pro změny, které tudy neprojdou (rename přes shell, ruční editace).
 */
export async function updateGraphFile(cwd, filePath) {
    const abs = isAbsolute(filePath) ? filePath : join(cwd, filePath);
    const relPath = toUnix(relative(cwd, abs));
    // Mimo projekt (cesta vede přes `..`) nebo prázdná → nic neděláme.
    if (relPath === '' || relPath.startsWith('..') || isAbsolute(relPath)) {
        return { path: relPath, status: 'skipped' };
    }
    // Chybějící / poškozený / jiná verze indexu → inkrement nemá na co navázat,
    // uděláme plný rebuild (ten index i adresář postaví od nuly).
    const index = await readGraphIndex(join(cwd, GRAPH_INDEX));
    if (!index) {
        await buildGraph(cwd);
        return { path: relPath, status: 'fell-back' };
    }
    // Nemapovatelná přípona nebo ignorovaný adresář (node_modules, dist, .mini, …)
    // → no-op. Drží to konzistenci s tím, co by namapoval plný build.
    const lang = detectLang(relPath);
    if (!lang || isIgnoredPath(relPath)) {
        return { path: relPath, status: 'skipped' };
    }
    const graphFileRel = posix.join(GRAPH_DIR, `${relPath}.md`);
    const graphFileAbs = join(cwd, graphFileRel);
    // Soubor zmizel → odeber uzel i záznam (pokud v indexu byl).
    let content;
    try {
        content = await readFile(abs, 'utf-8');
    }
    catch {
        await rm(graphFileAbs, { force: true });
        const without = index.files.filter((e) => e.path !== relPath);
        if (without.length === index.files.length) {
            return { path: relPath, status: 'skipped' };
        }
        await writeGraphIndexAtomic(cwd, {
            version: GRAPH_INDEX_VERSION,
            generatedAt: new Date().toISOString(),
            files: without,
        });
        return { path: relPath, status: 'removed' };
    }
    // Namapuj a zapiš uzel atomicky (tmp + rename), ať index nikdy neukazuje na
    // rozepsaný `.md`.
    const fileGraph = mapByLang(content, relPath, lang);
    await mkdir(dirname(graphFileAbs), { recursive: true });
    const tmpFileAbs = `${graphFileAbs}.tmp`;
    await writeFile(tmpFileAbs, renderFileGraph(fileGraph), 'utf-8');
    await rename(tmpFileAbs, graphFileAbs);
    // Upsert záznamu v indexu se zachováním pořadí (stejné `localeCompare` jako
    // plný build), pak index zapiš atomicky.
    const entry = {
        path: fileGraph.path,
        graphFile: toUnix(relative(cwd, graphFileAbs)),
        exports: fileGraph.exports.map((e) => e.name),
    };
    await writeGraphIndexAtomic(cwd, {
        version: GRAPH_INDEX_VERSION,
        generatedAt: new Date().toISOString(),
        files: upsertEntry(index.files, entry),
    });
    return { path: relPath, status: 'updated' };
}
/** Načte a zvaliduje index; vrátí `null`, když chybí, je poškozený nebo má jinou verzi. */
async function readGraphIndex(indexAbs) {
    let raw;
    try {
        raw = await readFile(indexAbs, 'utf-8');
    }
    catch {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== GRAPH_INDEX_VERSION || !Array.isArray(parsed.files)) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
/** Atomický zápis indexu (tmp + rename), stejný formát jako plný build. */
async function writeGraphIndexAtomic(cwd, index) {
    const indexAbs = join(cwd, GRAPH_INDEX);
    const tmpIndexAbs = `${indexAbs}.tmp`;
    await writeFile(tmpIndexAbs, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
    await rename(tmpIndexAbs, indexAbs);
}
/** Vloží/nahradí záznam a seřadí podle `path` (shodně s `buildGraph`). */
function upsertEntry(entries, entry) {
    const next = entries.filter((e) => e.path !== entry.path);
    next.push(entry);
    next.sort((a, b) => a.path.localeCompare(b.path));
    return next;
}
/** True, když některý adresářový segment cesty patří do `IGNORE_DIRS`. */
function isIgnoredPath(relPath) {
    const segments = relPath.split('/');
    // Poslední segment je soubor; kontrolujeme jen adresářové segmenty.
    return segments.slice(0, -1).some((seg) => IGNORE_DIRS.has(seg));
}
function mapByLang(content, relPath, lang) {
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
        case 'ruby':
            return mapRubyFile(content, relPath);
    }
}
/**
 * Detekuje, jestli má smysl spouštět vlastní mapper: hledá `tsconfig.json`,
 * `Cargo.toml`, `composer.json`, `pyproject.toml`, `setup.py`, `go.mod`,
 * `pom.xml`, `build.gradle`(`.kts` = i Kotlin), `Package.swift`, `Gemfile`, C#
 * `*.sln`/`*.csproj` nebo alespoň jeden mapovatelný soubor
 * (.ts/.tsx/.php/.rs/.py/.go/.java/.cs/.kt/.kts/.swift/.rb) v projektu (mimo
 * ignorované adresáře).
 */
export async function hasMappableProject(cwd = process.cwd()) {
    if (await fileExists(join(cwd, 'tsconfig.json')))
        return true;
    if (await fileExists(join(cwd, 'Cargo.toml')))
        return true;
    if (await fileExists(join(cwd, 'composer.json')))
        return true;
    if (await fileExists(join(cwd, 'pyproject.toml')))
        return true;
    if (await fileExists(join(cwd, 'setup.py')))
        return true;
    if (await fileExists(join(cwd, 'go.mod')))
        return true;
    if (await fileExists(join(cwd, 'pom.xml')))
        return true;
    if (await fileExists(join(cwd, 'build.gradle')))
        return true;
    if (await fileExists(join(cwd, 'build.gradle.kts')))
        return true;
    if (await fileExists(join(cwd, 'Package.swift')))
        return true;
    if (await fileExists(join(cwd, 'Gemfile')))
        return true;
    // C#: název `*.sln`/`*.csproj` je variabilní → koukneme po příponě v kořeni.
    if (await hasFileWithExt(cwd, ['.sln', '.csproj']))
        return true;
    const files = await collectMappableFiles(cwd, {}, /* stopAfter */ 1);
    return files.length > 0;
}
/** True, když v kořeni `cwd` leží soubor s některou z přípon `exts`. */
async function hasFileWithExt(cwd, exts) {
    let entries;
    try {
        entries = await readdir(cwd, { withFileTypes: true });
    }
    catch {
        return false;
    }
    return entries.some((e) => e.isFile() && exts.some((ext) => e.name.endsWith(ext)));
}
async function fileExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Vybere zdroj seznamu souborů: v git repu se ptáme gitu (respektuje `.gitignore`,
 * vnořené `.gitignore`, negace i globální excludes), jinak prohledáme strom sami
 * přes `walk` + `IGNORE_DIRS`. Když git z jakéhokoli důvodu selže (chybí binárka,
 * porušený repo), spadneme zpět na `walk`.
 */
async function collectFiles(cwd, options) {
    if (await isGitRepo(cwd)) {
        const fromGit = await collectFromGit(cwd, options);
        if (fromGit)
            return fromGit;
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
async function collectFromGit(cwd, options) {
    const r = await runGit(['ls-files', '-co', '--exclude-standard', '-z'], cwd);
    if (!r.ok)
        return null;
    const matches = [];
    for (const rel of r.stdout.split('\0')) {
        if (rel.length === 0)
            continue; // trailing NUL / prázdné řádky
        const lang = detectLang(rel);
        if (!lang)
            continue;
        if (options.includeFile && !options.includeFile(rel))
            continue;
        matches.push({ relPath: rel, lang });
    }
    return matches;
}
async function collectMappableFiles(cwd, options, stopAfter) {
    const matches = [];
    await walk(cwd, cwd, matches, options, stopAfter);
    return matches;
}
async function walk(rootDir, currentDir, matches, options, stopAfter) {
    if (stopAfter !== undefined && matches.length >= stopAfter)
        return;
    let entries;
    try {
        entries = await readdir(currentDir, { withFileTypes: true });
    }
    catch {
        return;
    }
    // sort, aby výstup byl deterministický (i když mapování později sort znovu)
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '..') {
            // Skryté soubory ignoruj (pokud nejsou explicitně v IGNORE_DIRS — pak by je
            // beztak filtr níž zachytil)
            if (IGNORE_DIRS.has(entry.name))
                continue;
            // Skryté soubory typu `.eslintrc.ts` jsou raritní; zachováme je jen pro
            // adresáře, které explicitně NEignorujeme. Default: skip skryté.
            if (entry.isDirectory())
                continue;
        }
        const full = join(currentDir, entry.name);
        if (entry.isDirectory()) {
            if (IGNORE_DIRS.has(entry.name))
                continue;
            await walk(rootDir, full, matches, options, stopAfter);
            if (stopAfter !== undefined && matches.length >= stopAfter)
                return;
            continue;
        }
        if (!entry.isFile())
            continue;
        const lang = detectLang(entry.name);
        if (!lang)
            continue;
        const rel = toUnix(relative(rootDir, full));
        if (options.includeFile && !options.includeFile(rel))
            continue;
        matches.push({ relPath: rel, lang });
        if (stopAfter !== undefined && matches.length >= stopAfter)
            return;
    }
}
function detectLang(name) {
    if (name.endsWith('.d.ts'))
        return null;
    if (name.endsWith('.ts') ||
        name.endsWith('.tsx') ||
        name.endsWith('.js') ||
        name.endsWith('.jsx') ||
        name.endsWith('.mjs') ||
        name.endsWith('.cjs')) {
        return 'ts';
    }
    if (name.endsWith('.php'))
        return 'php';
    if (name.endsWith('.rs'))
        return 'rust';
    if (name.endsWith('.py') || name.endsWith('.pyi'))
        return 'python';
    if (name.endsWith('.go'))
        return 'go';
    if (name.endsWith('.java'))
        return 'java';
    if (name.endsWith('.cs'))
        return 'csharp';
    if (name.endsWith('.kt') || name.endsWith('.kts'))
        return 'kotlin';
    if (name.endsWith('.swift'))
        return 'swift';
    if (name.endsWith('.rb'))
        return 'ruby';
    return null;
}
function toUnix(p) {
    if (sep === '/')
        return p;
    return p.split(sep).join(posix.sep);
}
/**
 * Vyrenderuje mapu **jednoho** souboru do kompaktního markdownu: `## cesta`
 * hlavička + imports / exports / metody jako bullety. Záměrně bez fenced kódu,
 * ať Claude může do toho zaměřovat search/grep bez markdown escape obtíží.
 * Jeden takový blok = obsah jednoho `.mini/graph/<cesta>.md`.
 */
export function renderFileGraph(file) {
    const lines = [];
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
function renderImport(imp) {
    const prefix = imp.typeOnly ? 'type ' : '';
    if (imp.symbols.length === 0)
        return `${prefix}side-effect "${imp.source}"`;
    const symbols = imp.symbols.join(', ');
    return `${prefix}{ ${symbols} } from "${imp.source}"`;
}
function renderExport(exp) {
    const lines = [];
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
function lineSuffix(exp) {
    if (exp.line === undefined)
        return '';
    if (exp.endLine !== undefined && exp.endLine > exp.line) {
        return ` @L${exp.line}-${exp.endLine}`;
    }
    return ` @L${exp.line}`;
}
function renderSignature(sig) {
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
