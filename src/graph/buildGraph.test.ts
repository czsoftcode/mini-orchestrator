import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildGraph, GRAPH_FILE, isTypeScriptProject, renderGraphMarkdown } from './buildGraph.js';

async function makeTempProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'mini-graph-'));
}

async function writeFixture(root: string, rel: string, content: string): Promise<void> {
  const abs = join(root, rel);
  await mkdir(join(abs, '..'), { recursive: true });
  await writeFile(abs, content, 'utf-8');
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

  it('walks TS files and writes .mini/graph.md', async () => {
    await writeFixture(root, 'src/a.ts', `export function a(): number { return 1; }\n`);
    await writeFixture(root, 'src/sub/b.tsx', `export const b = 'B';\n`);
    await writeFixture(root, 'node_modules/lib/x.ts', `export const x = 1;\n`);
    await writeFixture(root, 'dist/built.ts', `export const d = 1;\n`);
    await writeFixture(root, 'src/c.d.ts', `export declare const c: number;\n`);
    await writeFixture(root, 'README.md', `not TS\n`);

    const result = await buildGraph(root);

    expect(result.fileCount).toBe(2);
    expect(result.files.map((f) => f.path)).toEqual(['src/a.ts', 'src/sub/b.tsx']);

    const graphPath = join(root, GRAPH_FILE);
    const written = await readFile(graphPath, 'utf-8');
    expect(written).toContain('# Graf projektu');
    expect(written).toContain('## src/a.ts');
    expect(written).toContain('function a(): number');
    expect(written).toContain('## src/sub/b.tsx');
    expect(written).not.toContain('node_modules');
    expect(written).not.toContain('dist/built');
    expect(written).not.toContain('src/c.d.ts');
  });

  it('handles empty project (no TS files)', async () => {
    await writeFixture(root, 'README.md', `hello\n`);

    const result = await buildGraph(root);
    expect(result.fileCount).toBe(0);

    const written = await readFile(join(root, GRAPH_FILE), 'utf-8');
    expect(written).toContain('# Graf projektu');
    expect(written).toContain('_(žádné TS/TSX soubory)_');
  });

  it('isTypeScriptProject returns true when tsconfig exists', async () => {
    await writeFixture(root, 'tsconfig.json', '{}');
    expect(await isTypeScriptProject(root)).toBe(true);
  });

  it('isTypeScriptProject returns true when at least one .ts file exists', async () => {
    await writeFixture(root, 'src/x.ts', 'export const x = 1;');
    expect(await isTypeScriptProject(root)).toBe(true);
  });

  it('isTypeScriptProject returns false for a non-TS project', async () => {
    await writeFixture(root, 'package.json', '{}');
    await writeFixture(root, 'src/x.js', 'module.exports = {};');
    expect(await isTypeScriptProject(root)).toBe(false);
  });
});

describe('renderGraphMarkdown', () => {
  it('renders all the kinds with deterministic output', () => {
    const md = renderGraphMarkdown([
      {
        path: 'src/a.ts',
        imports: [
          { source: 'node:fs', symbols: ['readFile'] },
          { source: './b.js', symbols: ['default'] },
          { source: './c.js', symbols: ['*'] },
          { source: './side-effect.js', symbols: [] },
          { source: './only-types.js', symbols: ['Foo'], typeOnly: true },
        ],
        exports: [
          { name: 'foo', kind: 'function', signature: { parameters: [{ name: 'x', type: 'number' }], returnType: 'number' } },
          { name: 'Bar', kind: 'class', methods: [
            { name: 'run', signature: { parameters: [], returnType: 'void' } },
            { name: 'make', signature: { parameters: [], returnType: 'Bar' }, isStatic: true },
          ] },
          { name: 'Mode', kind: 'enum' },
          { name: 'Greeter', kind: 'interface' },
          { name: 'Result', kind: 'type' },
          { name: 'VERSION', kind: 'const' },
          { name: 'main', kind: 'function', signature: { parameters: [], returnType: 'number' }, isDefault: true },
        ],
      },
    ]);

    expect(md).toMatchSnapshot();
  });
});
