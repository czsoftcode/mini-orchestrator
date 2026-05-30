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
  updateGraphFile,
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

  it('mapuje i .go soubory a ignoruje vendor/', async () => {
    await writeFixture(root, 'main.go', `package main\n\nfunc Run() int { return 0 }\n`);
    await writeFixture(root, 'vendor/dep/x.go', `package dep\n\nfunc Ignored() {}\n`);

    const result = await buildGraph(root);
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('main.go');
    expect(paths).not.toContain('vendor/dep/x.go');

    const goMap = await readFile(join(root, GRAPH_DIR, 'main.go.md'), 'utf-8');
    expect(goMap).toContain('## main.go');
    expect(goMap).toContain('function Run');
    await expect(readFile(join(root, GRAPH_DIR, 'vendor/dep/x.go.md'), 'utf-8')).rejects.toThrow();
  });

  it('mapuje i .java soubory a ignoruje build/', async () => {
    await writeFixture(
      root,
      'src/Main.java',
      `package app;\npublic class Main {\n  public int run() { return 0; }\n}\n`,
    );
    await writeFixture(root, 'build/Generated.java', `public class Generated {}\n`);

    const result = await buildGraph(root);
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('src/Main.java');
    expect(paths).not.toContain('build/Generated.java');

    const javaMap = await readFile(join(root, GRAPH_DIR, 'src/Main.java.md'), 'utf-8');
    expect(javaMap).toContain('## src/Main.java');
    expect(javaMap).toContain('class Main');
    await expect(
      readFile(join(root, GRAPH_DIR, 'build/Generated.java.md'), 'utf-8'),
    ).rejects.toThrow();
  });

  it('hasMappableProject returns true when go.mod exists', async () => {
    await writeFixture(root, 'go.mod', 'module example.com/x\n\ngo 1.22\n');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when pom.xml exists', async () => {
    await writeFixture(root, 'pom.xml', '<project></project>\n');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when build.gradle exists', async () => {
    await writeFixture(root, 'build.gradle', 'plugins { id "java" }\n');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when only .java exists', async () => {
    await writeFixture(root, 'src/App.java', 'public class App {}');
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when only .go exists', async () => {
    await writeFixture(root, 'cmd/main.go', 'package main\nfunc main() {}');
    expect(await hasMappableProject(root)).toBe(true);
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

  it('hasMappableProject returns true when Gemfile exists', async () => {
    await writeFixture(root, 'Gemfile', "source 'https://rubygems.org'\n");
    expect(await hasMappableProject(root)).toBe(true);
  });

  it('hasMappableProject returns true when only .rb exists', async () => {
    await writeFixture(root, 'lib/foo.rb', 'class Foo\nend\n');
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

describe('updateGraphFile (inkrementální update)', () => {
  let root: string;

  beforeEach(async () => {
    root = await makeTempProject();
  });

  afterEach(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(root, { recursive: true, force: true });
  });

  it('nový soubor vloží uzel i záznam na správné místo v pořadí', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await writeFixture(root, 'src/c.ts', `export const c = 3;\n`);
    await buildGraph(root);

    // b.ts vznikne až teď
    await writeFixture(root, 'src/b.ts', `export const b = 2;\n`);
    const res = await updateGraphFile(root, 'src/b.ts');

    expect(res).toEqual({ path: 'src/b.ts', status: 'updated' });
    const bMap = await readFile(join(root, GRAPH_DIR, 'src/b.ts.md'), 'utf-8');
    expect(bMap).toContain('## src/b.ts');
    const index = await readIndex(root);
    expect(index.files.map((f) => f.path)).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(index.files.find((f) => f.path === 'src/b.ts')?.exports).toEqual(['b']);
  });

  it('změna existujícího souboru posune kotvy na řádky', async () => {
    const fn = `export function a(): number {\n  return 1;\n}\n`;
    await writeFixture(root, 'src/a.ts', fn);
    await buildGraph(root);
    const before = await readFile(join(root, GRAPH_DIR, 'src/a.ts.md'), 'utf-8');
    expect(before).toContain('@L1-3');

    // přidáme dva řádky nad funkci → deklarace se posune o 2
    await writeFixture(root, 'src/a.ts', `const x = 1;\nconst y = 2;\n${fn}`);
    const res = await updateGraphFile(root, 'src/a.ts');

    expect(res.status).toBe('updated');
    const after = await readFile(join(root, GRAPH_DIR, 'src/a.ts.md'), 'utf-8');
    expect(after).toContain('@L3-5');
    expect(after).not.toContain('@L1-3');
  });

  it('zmizelý soubor odebere uzel i záznam', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await writeFixture(root, 'src/b.ts', `export const b = 2;\n`);
    await buildGraph(root);

    const { rm } = await import('node:fs/promises');
    await rm(join(root, 'src/b.ts'));
    const res = await updateGraphFile(root, 'src/b.ts');

    expect(res).toEqual({ path: 'src/b.ts', status: 'removed' });
    await expect(readFile(join(root, GRAPH_DIR, 'src/b.ts.md'), 'utf-8')).rejects.toThrow();
    const index = await readIndex(root);
    expect(index.files.map((f) => f.path)).toEqual(['src/a.ts']);
  });

  it('nemapovatelný soubor je no-op (skipped)', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await buildGraph(root);
    const before = await readIndex(root);

    await writeFixture(root, 'README.md', `# hello\n`);
    const res = await updateGraphFile(root, 'README.md');

    expect(res.status).toBe('skipped');
    const after = await readIndex(root);
    expect(after.files).toEqual(before.files);
  });

  it('soubor v ignorovaném adresáři je no-op (skipped)', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    await buildGraph(root);

    await writeFixture(root, 'node_modules/lib/x.ts', `export const x = 1;\n`);
    const res = await updateGraphFile(root, 'node_modules/lib/x.ts');

    expect(res.status).toBe('skipped');
    await expect(
      readFile(join(root, GRAPH_DIR, 'node_modules/lib/x.ts.md'), 'utf-8'),
    ).rejects.toThrow();
  });

  it('chybějící index spadne na plný build (fell-back)', async () => {
    await writeFixture(root, 'src/a.ts', `export const a = 1;\n`);
    // žádný buildGraph předem → graph.json neexistuje
    const res = await updateGraphFile(root, 'src/a.ts');

    expect(res.status).toBe('fell-back');
    const index = await readIndex(root);
    expect(index.files.map((f) => f.path)).toEqual(['src/a.ts']);
  });
});
