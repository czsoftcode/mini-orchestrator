import { describe, expect, it } from 'vitest';
import { mapFile } from './mapper.js';

const FIXTURE = `
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as os from 'node:os';
import type { Foo } from './foo.js';
import './side-effect.js';

export interface Greeter {
  name: string;
}

export type Result = { ok: true } | { ok: false; reason: string };

export enum Mode {
  Slow,
  Fast,
}

export const VERSION = '0.1.0';
export const greet = (name: string, loud?: boolean): string => name;

export function add(a: number, b: number): number {
  return a + b;
}

export async function load(path: string, opts?: { force?: boolean }): Promise<Result> {
  return { ok: true };
}

export class Service {
  static create(): Service { return new Service(); }
  run(name: string, ...args: number[]): Promise<void> { return Promise.resolve(); }
  private secret(): void {}
}

export default function main(argv: string[]): number {
  return 0;
}
`;

describe('mapFile', () => {
  const graph = mapFile(FIXTURE, 'src/example.ts');

  it('sets the unix-slash path', () => {
    expect(graph.path).toBe('src/example.ts');
  });

  it('captures imports including type-only and namespace', () => {
    const sources = graph.imports.map((i) => i.source);
    expect(sources).toEqual([
      'node:fs/promises',
      'node:path',
      'node:os',
      './foo.js',
      './side-effect.js',
    ]);

    const named = graph.imports.find((i) => i.source === 'node:fs/promises');
    expect(named?.symbols).toEqual(['readFile']);

    const defaultImport = graph.imports.find((i) => i.source === 'node:path');
    expect(defaultImport?.symbols).toEqual(['default']);

    const ns = graph.imports.find((i) => i.source === 'node:os');
    expect(ns?.symbols).toEqual(['*']);

    const typeOnly = graph.imports.find((i) => i.source === './foo.js');
    expect(typeOnly?.typeOnly).toBe(true);
    expect(typeOnly?.symbols).toEqual(['Foo']);

    const sideEffect = graph.imports.find((i) => i.source === './side-effect.js');
    expect(sideEffect?.symbols).toEqual([]);
  });

  it('captures interface/type/enum kinds', () => {
    expect(graph.exports.find((e) => e.name === 'Greeter')?.kind).toBe('interface');
    expect(graph.exports.find((e) => e.name === 'Result')?.kind).toBe('type');
    expect(graph.exports.find((e) => e.name === 'Mode')?.kind).toBe('enum');
  });

  it('captures const exports', () => {
    const version = graph.exports.find((e) => e.name === 'VERSION');
    expect(version?.kind).toBe('const');
    expect(version?.signature).toBeUndefined();
  });

  it('captures arrow-function const as function with signature', () => {
    const greet = graph.exports.find((e) => e.name === 'greet');
    expect(greet?.kind).toBe('function');
    expect(greet?.signature?.parameters).toEqual([
      { name: 'name', type: 'string' },
      { name: 'loud', type: 'boolean', optional: true },
    ]);
    expect(greet?.signature?.returnType).toBe('string');
  });

  it('captures function declarations with parameters and return type', () => {
    const add = graph.exports.find((e) => e.name === 'add');
    expect(add?.kind).toBe('function');
    expect(add?.signature).toEqual({
      parameters: [
        { name: 'a', type: 'number' },
        { name: 'b', type: 'number' },
      ],
      returnType: 'number',
    });
  });

  it('captures async function with complex types', () => {
    const load = graph.exports.find((e) => e.name === 'load');
    expect(load?.signature?.parameters[1]?.optional).toBe(true);
    expect(load?.signature?.returnType).toBe('Promise<Result>');
  });

  it('captures class methods skipping private ones', () => {
    const service = graph.exports.find((e) => e.name === 'Service');
    expect(service?.kind).toBe('class');
    const methodNames = service?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toContain('create');
    expect(methodNames).toContain('run');
    expect(methodNames).not.toContain('secret');

    const create = service?.methods?.find((m) => m.name === 'create');
    expect(create?.isStatic).toBe(true);
    expect(create?.signature.returnType).toBe('Service');

    const run = service?.methods?.find((m) => m.name === 'run');
    expect(run?.signature.parameters[1]?.rest).toBe(true);
  });

  it('captures export default function', () => {
    const main = graph.exports.find((e) => e.isDefault === true);
    expect(main?.name).toBe('main');
    expect(main?.kind).toBe('function');
    expect(main?.signature?.parameters[0]).toEqual({ name: 'argv', type: 'string[]' });
  });

  it('handles re-exports and namespace re-exports', () => {
    const reexport = mapFile(
      `
export { foo, bar as baz } from './other.js';
export * from './all.js';
`,
      'src/reex.ts',
    );

    const names = reexport.exports.map((e) => e.name);
    expect(names).toContain('foo');
    expect(names).toContain('baz');
    expect(names.some((n) => n.startsWith('* from'))).toBe(true);
  });

  it('handles destructuring parameters', () => {
    const out = mapFile(
      `export function take({ a, b }: { a: number; b: number }): number { return a + b; }`,
      'src/d.ts',
    );
    const fn = out.exports[0];
    expect(fn?.signature?.parameters[0]?.name).toBe('{...}');
  });
});
