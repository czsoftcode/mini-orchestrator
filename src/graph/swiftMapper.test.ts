import { describe, expect, it } from 'vitest';
import { mapSwiftFile } from './swiftMapper.js';

const FIXTURE = `// Line comment: func fakeInComment() {}
import Foundation
import UIKit
import Swift.String
import struct Combine.Just
import func MyLib.helper

/* block /* vnořený */ stále komentář
func fakeInBlock() {}
*/

/** Doc: class FakeDoc */
let greeting = "func fakeInString() {}"
let raw = #"func fakeInRaw() {}"#
let multi = """
  func fakeInMulti() {}
"""

func topLevel(_ name: String, times: Int = 1) -> String {
    let c = "x"
    return name + c
}

func identity<T>(value: T) -> T {
    return value
}

func noBody()

private func hidden() {}

fileprivate func alsoHidden() {}

internal func internalFn() {}

public class Greeter: Speaker {
    var name: String = "x"
    let id: Int = 0

    func greet(_ name: String, with prefix: String) -> String {
        return prefix + name
    }

    private func secret() {}
    fileprivate func alsoSecret() {}
    static func make() -> Greeter { return Greeter() }
    class func build() -> Greeter { return Greeter() }

    init(name: String) { self.name = name }

    struct Inner {
        func innerMethod() {}
    }
}

struct Point {
    var x: Int
    var y: Int

    func magnitude() -> Double { return 0 }
}

enum Color {
    case red, green, blue

    func rgb() -> Int { return 0 }
}

protocol Speaker {
    func speak() -> String
}

actor Counter {
    func increment() {}
}

extension String {
    func shout() -> String { return self + "!" }
}

private struct HiddenStruct {
    func wontShow() {}
}
`;

describe('mapSwiftFile', () => {
  const graph = mapSwiftFile(FIXTURE, 'Sources\\App\\Greeter.swift');

  it('používá unixová lomítka v cestě', () => {
    expect(graph.path).toBe('Sources/App/Greeter.swift');
  });

  it('zachycuje importy vč. submodulů a kindů', () => {
    const foundation = graph.imports.find((i) => i.source === 'Foundation');
    expect(foundation?.symbols).toEqual(['Foundation']);

    const sub = graph.imports.find((i) => i.source === 'Swift.String');
    expect(sub?.symbols).toEqual(['String']);

    const kindStruct = graph.imports.find((i) => i.source === 'Combine.Just');
    expect(kindStruct?.symbols).toEqual(['Just']); // import struct Combine.Just

    const kindFunc = graph.imports.find((i) => i.source === 'MyLib.helper');
    expect(kindFunc?.symbols).toEqual(['helper']); // import func MyLib.helper
  });

  it('nezahrne kód z komentářů ani stringů (vč. vnořeného bloku, raw a víceřádkového)', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('fakeInComment');
    expect(names).not.toContain('fakeInBlock'); // vnořený block komentář
    expect(names).not.toContain('FakeDoc');
    expect(names).not.toContain('fakeInString');
    expect(names).not.toContain('fakeInRaw'); // raw string
    expect(names).not.toContain('fakeInMulti'); // víceřádkový string
    // top-level let/var se nemapují jako export
    expect(names).not.toContain('greeting');
    expect(names).not.toContain('raw');
  });

  it('mapuje top-level func se signaturou a kotvami', () => {
    const fn = graph.exports.find((e) => e.name === 'topLevel');
    expect(fn?.kind).toBe('function');
    expect(fn?.line).toBeDefined();
    expect(fn?.endLine).toBeDefined();
    expect(fn!.endLine!).toBeGreaterThan(fn!.line!);
    // interní jméno parametru (`_ name` → name), default → optional
    expect(fn?.signature?.parameters).toEqual([
      { name: 'name', type: 'String' },
      { name: 'times', type: 'Int', optional: true },
    ]);
    expect(fn?.signature?.returnType).toBe('String');
  });

  it('zvládne generika i func bez těla (požadavek protokolu)', () => {
    const identity = graph.exports.find((e) => e.name === 'identity');
    expect(identity?.kind).toBe('function');
    expect(identity?.signature?.parameters).toEqual([{ name: 'value', type: 'T' }]);
    expect(identity?.signature?.returnType).toBe('T');

    const noBody = graph.exports.find((e) => e.name === 'noBody');
    expect(noBody?.kind).toBe('function');
  });

  it('vynechá private i fileprivate top-level func', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('hidden'); // private
    expect(names).not.toContain('alsoHidden'); // fileprivate
    expect(names).toContain('internalFn'); // internal je default-viditelná
  });

  it('mapuje class s viditelnými metodami, vynechá private/fileprivate/vnořené/vlastnosti', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.kind).toBe('class');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toContain('greet');
    expect(methodNames).toContain('make'); // static
    expect(methodNames).toContain('build'); // class func
    expect(methodNames).not.toContain('secret'); // private
    expect(methodNames).not.toContain('alsoSecret'); // fileprivate
    expect(methodNames).not.toContain('name'); // vlastnost
    expect(methodNames).not.toContain('id'); // vlastnost
    expect(methodNames).not.toContain('innerMethod'); // metoda vnořeného typu

    const greet = greeter?.methods?.find((m) => m.name === 'greet');
    // interní jména: `_ name` → name, `with prefix` → prefix
    expect(greet?.signature?.parameters).toEqual([
      { name: 'name', type: 'String' },
      { name: 'prefix', type: 'String' },
    ]);
    expect(greet?.signature?.returnType).toBe('String');

    const make = greeter?.methods?.find((m) => m.name === 'make');
    expect(make?.isStatic).toBe(true);
    const build = greeter?.methods?.find((m) => m.name === 'build');
    expect(build?.isStatic).toBe(true);
  });

  it('rozliší struct, enum, protocol, actor a extension', () => {
    const point = graph.exports.find((e) => e.name === 'Point');
    expect(point?.kind).toBe('struct');
    expect(point?.methods?.map((m) => m.name)).toContain('magnitude');

    const color = graph.exports.find((e) => e.name === 'Color');
    expect(color?.kind).toBe('enum');
    expect(color?.methods?.map((m) => m.name)).toContain('rgb');

    const speaker = graph.exports.find((e) => e.name === 'Speaker');
    expect(speaker?.kind).toBe('interface'); // protocol
    expect(speaker?.methods?.map((m) => m.name)).toContain('speak');

    const counter = graph.exports.find((e) => e.name === 'Counter');
    expect(counter?.kind).toBe('class'); // actor
    expect(counter?.methods?.map((m) => m.name)).toContain('increment');

    const ext = graph.exports.find((e) => e.name === 'String');
    expect(ext?.kind).toBe('class'); // extension
    expect(ext?.methods?.map((m) => m.name)).toContain('shout');
  });

  it('vynechá private typ celý', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('HiddenStruct');
    expect(names).not.toContain('wontShow');
  });

  it('kotvy ukazují na správné řádky deklarací', () => {
    const lines = FIXTURE.split('\n');
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(lines[greeter!.line! - 1]).toContain('class Greeter');
    expect(lines[greeter!.endLine! - 1]).toBe('}');
  });

  it('parsuje variadické a default parametry vč. async throws', () => {
    const src = `func build(prefix: String = "x", _ parts: Int...) async throws -> String { return "" }`;
    const g = mapSwiftFile(src, 'B.swift');
    const fn = g.exports.find((e) => e.name === 'build');
    expect(fn?.signature?.parameters).toEqual([
      { name: 'prefix', type: 'String', optional: true },
      { name: 'parts', type: 'Int', rest: true },
    ]);
    expect(fn?.signature?.returnType).toBe('String');
  });

  it('zvládne where klauzuli u generické funkce', () => {
    const src = `func clamp<T>(_ v: T) -> T where T: Comparable { return v }`;
    const g = mapSwiftFile(src, 'C.swift');
    const fn = g.exports.find((e) => e.name === 'clamp');
    expect(fn?.kind).toBe('function');
    expect(fn?.signature?.returnType).toBe('T');
    expect(fn?.signature?.parameters).toEqual([{ name: 'v', type: 'T' }]);
  });

  it('respektuje private(set) jako viditelnou deklaraci', () => {
    const src = `private(set) public func tracked() {}`;
    const g = mapSwiftFile(src, 'D.swift');
    expect(g.exports.map((e) => e.name)).toContain('tracked');
  });
});
