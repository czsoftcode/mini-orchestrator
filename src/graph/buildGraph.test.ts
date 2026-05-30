import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildGraph,
  GRAPH_DIR,
  GRAPH_INDEX,
  GRAPH_INDEX_VERSION,
  hasMappableProject,
  LEGACY_GRAPH_FILE,
  renderFileGraph,
} from './buildGraph.js';
import type { GraphIndex } from './buildGraph.js';
import { runGit } from '../git.js';

async function makeTempProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'mini-graph-'));
}

async function writeFixture(root: string, rel: string, content: string): Promise<void> {
  const abs = join(root, rel);
  await mkdir(join(abs, '..'), { recursive: true });
  await writeFile(abs, content, 'utf-8');
}

async function readIndex(root: string): Promise<GraphIndex> {
  return JSON.parse(await readFile(join(root, GRAPH_INDEX), 'utf-8')) as GraphIndex;
}

describe('buildGraph', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempProject();
  });

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });

  it('walks TS files and writes per-file maps + index', async () => {
    await writeFixture(root, 'src/a.ts', `export function a(): number { return 1; }\n`);
    await writeFixture(root, 'src/sub/b.tsx', `export const b = 'B';\n`);
    await writeFixture(root, 'node_modules/lib/x.ts', `export const x = 1;\n`);
    await writeFixture(root, 'dist/built.ts', `export const d = 1;\n`);
    await writeFixture(root, 'src/c.d.ts', `export declare const c: number;\n`);
    await writeFixture(root, 'README.md', `not TS\n`);

    const result = await buildGraph(root);

    expect(result.fileCount).toBe(2);
    expect(result.files.map((f) => f.path)).toEqual(['src/a.ts', 'src/sub/b.tsx']);
    expect(result.indexFile).toBe(GRAPH_INDEX);
    expect(result.graphDir).toBe(GRAPH_DIR);

    // per-file mapy zrcadlí strom zdrojáků
    const aMap = await readFile(join(root, GRAPH_DIR, 'src/a.ts.md'), 'utf-8');
    expect(aMap).toContain('## src/a.ts');
    expect(aMap).toContain('function a(): number');
    const bMap = await readFile(join(root, GRAPH_DIR, 'src/sub/b.tsx.md'), 'utf-8');
    expect(bMap).toContain('## src/sub/b.tsx');

    // ignorované soubory se nenamapovaly
    await expect(readFile(join(root, GRAPH_DIR, 'node_modules/lib/x.ts.md'), 'utf-8')).rejects.toThrow();
    await expect(readFile(join(root, GRAPH_DIR, 'dist/built.ts.md'), 'utf-8')).rejects.toThrow();
    await expect(readFile(join(root, GRAPH_DIR, 'src/c.d.ts.md'), 'utf-8')).rejects.toThrow();

    // index: verze, cesty, názvy exportů
    const index = await readIndex(root);
    expect(index.version).toBe(GRAPH_INDEX_VERSION);
    expect(typeof index.generatedAt).toBe('string');
    expect(index.files).toEqual([
      { path: 'src/a.ts', graphFile: '.mini/graph/src/a.ts.md', exports: ['a'] },
      { path: 'src/sub/b.tsx', graphFile: '.mini/graph/src/sub/b.tsx.md', exports: ['b'] },
    ]);
  });

  it('zapisuje atomicky — nezůstanou .tmp zbytky', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await buildGraph(root);

    const miniEntries = await readdir(join(root, '.mini'));
    expect(miniEntries).toContain('graph');
    expect(miniEntries).toContain('graph.json');
    expect(miniEntries).not.toContain('graph.tmp');
    expect(miniEntries).not.toContain('graph.json.tmp');
  });

  it('smaže starý monolitický graph.md', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    // simuluj starý layout
    await writeFixture(root, LEGACY_GRAPH_FILE, `# Graf projektu\n`);

    await buildGraph(root);

    await expect(readFile(join(root, LEGACY_GRAPH_FILE), 'utf-8')).rejects.toThrow();
  });

  it('přegenerování odstraní mapu smazaného zdrojáku', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await writeFixture(root, 'src/b.ts', `export const b = 2;\n`);
    await buildGraph(root);
    expect(await readFile(join(root, GRAPH_DIR, 'src/b.ts.md'), 'utf-8')).toContain('## src/b.ts');

    // b.ts zmizí → druhý běh už jeho mapu nemá
    const { rm } = await import('node:fs/promises');
    await rm(join(root, 'src/b.ts'));
    await buildGraph(root);

    await expect(readFile(join(root, GRAPH_DIR, 'src/b.ts.md'), 'utf-8')).rejects.toThrow();
    expect(await readFile(join(root, GRAPH_DIR, 'src/a.ts.md'), 'utf-8')).toContain('## src/a.ts');
    const index = await readIndex(root);
    expect(index.files.map((f) => f.path)).toEqual(['src/a.ts']);
  });

  it('handles empty project (no mapovatelné soubory)', async () => {
    await writeFixture(root, 'README.md', `hello\n`);

    const result = await buildGraph(root);
    expect(result.fileCount).toBe(0);

    const index = await readIndex(root);
    expect(index.files).toEqual([]);
    // adresář existuje, ale je prázdný
    const dirEntries = await readdir(join(root, GRAPH_DIR));
    expect(dirEntries).toEqual([]);
  });

  it('mapuje i .php, .rs a .py soubory vedle TS/TSX', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await writeFixture(root, 'src/lib.rs', `pub fn run() -> u32 { 0 }\n`);
    await writeFixture(root, 'app/Service.php', `<?php\nclass Service {}\n`);
    await writeFixture(root, 'app/worker.py', `def run():\n    return 1\n`);
    await writeFixture(root, 'vendor/x.php', `<?php\nclass Vendor {}\n`);
    await writeFixture(root, 'target/y.rs', `pub fn ignored() {}\n`);
    await writeFixture(root, '.venv/lib/ignored.py', `def ignored():\n    pass\n`);

    const result = await buildGraph(root);
    const paths = result.files.map((f) => f.path);
    expect(paths).toEqual(['app/Service.php', 'app/worker.py', 'src/a.ts', 'src/lib.rs']);

    expect(await readFile(join(root, GRAPH_DIR, 'app/Service.php.md'), 'utf-8')).toContain('## app/Service.php');
    expect(await readFile(join(root, GRAPH_DIR, 'src/lib.rs.md'), 'utf-8')).toContain('## src/lib.rs');
    expect(await readFile(join(root, GRAPH_DIR, 'app/worker.py.md'), 'utf-8')).toContain('## app/worker.py');
    await expect(readFile(join(root, GRAPH_DIR, 'vendor/x.php.md'), 'utf-8')).rejects.toThrow();
    await expect(readFile(join(root, GRAPH_DIR, 'target/y.rs.md'), 'utf-8')).rejects.toThrow();
    await expect(readFile(join(root, GRAPH_DIR, '.venv/lib/ignored.py.md'), 'utf-8')).rejects.toThrow();
  });

  it('hasMappableProject returns true when pyproject.toml exists', async () => {
    await writeFixture(root, 'pyproject.toml', '[project]\nname = "x"\n');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when tsconfig exists', async () => {
    await writeFixture(root, 'tsconfig.json', '{}');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when at least one .ts file exists', async () => {
    await writeFixture(root, 'src/x.ts', 'export const x = 1;');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when only .php exists', async () => {
    await writeFixture(root, 'app/Foo.php', '<?php class Foo {}');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when only .rs exists', async () => {
    await writeFixture(root, 'src/main.rs', 'pub fn main() {}');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when only .js exists', async () => {
    await writeFixture(root, 'src/x.js', 'export const x = 1;');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns false for projekt bez mapovatelných souborů', async () => {
    await writeFixture(root, 'package.json', '{}');
    await writeFixture(root, 'styles.css', 'body{}');
    await writeFixture(root, 'README.md', 'hello');
    expect(await hasMappableProject(root)).toBe(false);
  });
});

describe('buildGraph v git repu respektuje .gitignore', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempProject();
    await runGit(['init'], root);
  });

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });

  it('přeskočí ignorované soubory (var/cache) a mapuje zdrojáky vč. JS', async () => {
    await writeFixture(root, '.gitignore', 'var/\n');
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await writeFixture(root, 'src/util.js', `export function f() { return 1; }\n`);
    await writeFixture(root, 'var/cache/Container.php', `<?php\nclass Container {}\n`);

    const result = await buildGraph(root);
    const paths = result.files.map((f) => f.path);

    expect(paths).toContain('src/a.ts');
    expect(paths).toContain('src/util.js');
    // var/ je v .gitignore → git ho nevypíše → do grafu se nedostane
    expect(paths).not.toContain('var/cache/Container.php');
    await expect(
      readFile(join(root, GRAPH_DIR, 'var/cache/Container.php.md'), 'utf-8'),
    ).rejects.toThrow();
  });

  it('mapuje i untracked soubory, které .gitignore neignoruje', async () => {
    // žádný commit — spoléháme na `ls-files -o` (untracked, ne-ignorované)
    await writeFixture(root, 'src/fresh.ts', `export const fresh = 1;\n`);

    const result = await buildGraph(root);
    expect(result.files.map((f) => f.path)).toContain('src/fresh.ts');
  });
});

describe('renderFileGraph', () => {
  it('renders all the kinds with deterministic output', () => {
    const md = renderFileGraph({
      path: 'src/a.ts',
      imports: [
        { source: 'node:fs', symbols: ['readFile'] },
        { source: './b.js', symbols: ['default'] },
        { source: './c.js', symbols: ['*'] },
        { source: './side-effect.js', symbols: [] },
        { source: './only-types.js', symbols: ['Foo'], typeOnly: true },
      ],
      exports: [
        { name: 'foo', kind: 'function', signature: { parameters: [{ name: 'x', type: 'number' }], returnType: 'number' }, line: 5, endLine: 8 },
        { name: 'Bar', kind: 'class', line: 10, endLine: 20, methods: [
          { name: 'run', signature: { parameters: [], returnType: 'void' } },
          { name: 'make', signature: { parameters: [], returnType: 'Bar' }, isStatic: true },
        ] },
        { name: 'Mode', kind: 'enum', line: 22, endLine: 25 },
        { name: 'Greeter', kind: 'interface' },
        { name: 'Result', kind: 'type' },
        { name: 'VERSION', kind: 'const', line: 27 },
        { name: 'main', kind: 'function', signature: { parameters: [], returnType: 'number' }, isDefault: true, line: 29, endLine: 31 },
      ],
    });

    expect(md).toMatchSnapshot();
  });

  it('renders placeholder for soubor bez exportů i importů', () => {
    const md = renderFileGraph({ path: 'src/empty.ts', imports: [], exports: [] });
    expect(md).toContain('## src/empty.ts');
    expect(md).toContain('_(žádné exporty ani importy)_');
  });
});
