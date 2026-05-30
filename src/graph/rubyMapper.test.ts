import { describe, expect, it } from 'vitest';
import { mapRubyFile } from './rubyMapper.js';

const FIXTURE = `# Line comment: def fake_in_comment; end
require 'set'
require_relative '../lib/helper'
require("json")

=begin
def fake_in_block
end
=end

GREETING = "def fake_in_string; end"

def top_level(name, times = 1)
  c = name
  c
end

def self.module_fn(a, *rest, key:, opt: 5, &blk)
  a
end

def endless(x) = x * 2

class Greeter < Base
  attr_reader :name
  attr_accessor :prefix

  def initialize(prefix)
    @prefix = prefix
  end

  def greet(other)
    @prefix + other
  end

  def self.build
    new("hi")
  end

  private

  def secret
    42
  end

  protected

  def helper
    1
  end

  class Inner
    def inner_method
    end
  end
end

module Greetable
  def hello
    "hi"
  end
end

module Outer
  class Nested
    def deep
    end
  end
end
`;

describe('mapRubyFile', () => {
  const graph = mapRubyFile(FIXTURE, 'app\\models\\greeter.rb');

  it('používá unixová lomítka v cestě', () => {
    expect(graph.path).toBe('app/models/greeter.rb');
  });

  it('zachycuje require i require_relative se závorkami', () => {
    const sources = graph.imports.map((i) => i.source);
    expect(sources).toContain('set');
    expect(sources).toContain('../lib/helper');
    expect(sources).toContain('json');
    // require je side-effect load — bez pojmenovaných symbolů
    expect(graph.imports.every((i) => i.symbols.length === 0)).toBe(true);
  });

  it('nezahrne kód z komentářů ani stringů (vč. =begin bloku a stringu)', () => {
    const names = graph.exports.flatMap((e) => [e.name, ...(e.methods?.map((m) => m.name) ?? [])]);
    expect(names).not.toContain('fake_in_comment');
    expect(names).not.toContain('fake_in_block'); // =begin/=end blok
    expect(names).not.toContain('fake_in_string');
    // top-level konstanta se nemapuje
    expect(graph.exports.map((e) => e.name)).not.toContain('GREETING');
  });

  it('mapuje top-level def se signaturou a kotvami', () => {
    const fn = graph.exports.find((e) => e.name === 'top_level');
    expect(fn?.kind).toBe('function');
    expect(fn?.line).toBeDefined();
    expect(fn?.endLine).toBeDefined();
    expect(fn!.endLine!).toBeGreaterThan(fn!.line!);
    expect(fn?.signature?.parameters).toEqual([
      { name: 'name' },
      { name: 'times', optional: true },
    ]);
  });

  it('zvládne splat, keyword, default i block parametry', () => {
    const fn = graph.exports.find((e) => e.name === 'module_fn');
    expect(fn?.signature?.parameters).toEqual([
      { name: 'a' },
      { name: 'rest', rest: true },
      { name: 'key' },
      { name: 'opt', optional: true },
      { name: 'blk' },
    ]);
  });

  it('mapuje endless metodu (def x = …) bez těla', () => {
    const fn = graph.exports.find((e) => e.name === 'endless');
    expect(fn?.kind).toBe('function');
    expect(fn?.signature?.parameters).toEqual([{ name: 'x' }]);
  });

  it('mapuje class s viditelnými metodami a atributy, vynechá private/protected/vnořené', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.kind).toBe('class');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toContain('greet');
    expect(methodNames).toContain('initialize');
    expect(methodNames).toContain('build'); // def self.build
    expect(methodNames).toContain('name'); // attr_reader
    expect(methodNames).toContain('prefix'); // attr_accessor reader
    expect(methodNames).toContain('prefix='); // attr_accessor writer
    expect(methodNames).not.toContain('secret'); // private
    expect(methodNames).not.toContain('helper'); // protected
    expect(methodNames).not.toContain('inner_method'); // metoda vnořené třídy

    const build = greeter?.methods?.find((m) => m.name === 'build');
    expect(build?.isStatic).toBe(true);
    const greet = greeter?.methods?.find((m) => m.name === 'greet');
    expect(greet?.signature?.parameters).toEqual([{ name: 'other' }]);
  });

  it('mapuje module jako kind module s metodami', () => {
    const mod = graph.exports.find((e) => e.name === 'Greetable');
    expect(mod?.kind).toBe('module');
    expect(mod?.methods?.map((m) => m.name)).toContain('hello');
  });

  it('vnořený typ se nemapuje jako samostatný export', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).toContain('Outer');
    expect(names).not.toContain('Inner');
    expect(names).not.toContain('Nested');
  });

  it('kotvy ukazují na správné řádky deklarací', () => {
    const lines = FIXTURE.split('\n');
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(lines[greeter!.line! - 1]).toContain('class Greeter');
    expect(lines[greeter!.endLine! - 1]).toBe('end');
  });

  it('nerozhodí vnoření blokovými openery (if/do) uvnitř metody', () => {
    const src = `class Box
  def run(items)
    items.each do |x|
      if x > 0
        puts x
      end
    end
  end

  def size
    0
  end
end
`;
    const g = mapRubyFile(src, 'box.rb');
    const box = g.exports.find((e) => e.name === 'Box');
    const methodNames = box?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toEqual(['run', 'size']);
  });
});
