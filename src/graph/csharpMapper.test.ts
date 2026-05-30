import { describe, expect, it } from 'vitest';
import { mapCSharpFile } from './csharpMapper.js';

const FIXTURE = `// Comment: class FakeInComment {}
using System;
using System.Collections.Generic;
using static System.Math;
using Json = System.Text.Json;
global using System.Linq;

/* block komentář:
class FakeBlock {}
public void fakeMethod() {}
*/

namespace Acme.App
{
    /// <summary> class FakeXmlDoc {} </summary>
    [Serializable]
    public sealed class Greeter : ISpeaker
    {
        private readonly string prefix = "class FakeString {}";
        public const int MAX = 100;
        public string Name { get; set; }

        public Greeter(string prefix)
        {
            this.prefix = prefix;
        }

        public string Greet(string name, int times = 1)
        {
            var s = $"void fakeInBody() {{}}";
            var v = @"C:\\temp\\class FakeVerbatim {}";
            return prefix + name;
        }

        internal static List<string> Names(List<string> input, params string[] extra) => input;

        private void Hidden() {}

        public class Inner
        {
            public void InnerMethod() {}
        }
    }

    interface ISpeaker
    {
        string Speak();
    }

    public interface ILoud
    {
        void Shout();
    }

    public enum Color { Red, Green, Blue }

    public readonly struct Point
    {
        public int Sum() => 0;
    }

    public record Money(decimal Amount, string Currency)
    {
        public string Describe() => "";
    }

    public record struct Vec(int X, int Y);

    file class FileLocal {}
}
`;

describe('mapCSharpFile', () => {
  const graph = mapCSharpFile(FIXTURE, 'Acme\\App\\Greeter.cs');

  it('používá unixová lomítka v cestě', () => {
    expect(graph.path).toBe('Acme/App/Greeter.cs');
  });

  it('zachycuje using, static, alias i global using', () => {
    const sys = graph.imports.find((i) => i.source === 'System');
    expect(sys?.symbols).toEqual(['System']);

    const generic = graph.imports.find((i) => i.source === 'System.Collections.Generic');
    expect(generic?.symbols).toEqual(['Generic']);

    const math = graph.imports.find((i) => i.source === 'System.Math');
    expect(math?.symbols).toEqual(['Math']); // using static

    const alias = graph.imports.find((i) => i.source === 'System.Text.Json');
    expect(alias?.symbols).toEqual(['Json']); // alias jméno

    const linq = graph.imports.find((i) => i.source === 'System.Linq');
    expect(linq?.symbols).toEqual(['Linq']); // global using
  });

  it('nezahrne namespace deklaraci do importů', () => {
    expect(graph.imports.some((i) => i.source.includes('Acme'))).toBe(false);
  });

  it('mapuje public class s kotvami a kindem', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.kind).toBe('class');
    expect(greeter?.line).toBeDefined();
    expect(greeter?.endLine).toBeDefined();
    expect(greeter!.endLine!).toBeGreaterThan(greeter!.line!);
  });

  it('připojí public/internal metody k typu se signaturou', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toContain('Greet');
    expect(methodNames).toContain('Names'); // internal
    expect(methodNames).toContain('Greeter'); // konstruktor
    expect(methodNames).not.toContain('Hidden'); // private

    const greet = greeter?.methods?.find((m) => m.name === 'Greet');
    expect(greet?.signature?.parameters).toEqual([
      { name: 'name', type: 'string' },
      { name: 'times', type: 'int', optional: true },
    ]);

    const names = greeter?.methods?.find((m) => m.name === 'Names');
    expect(names?.isStatic).toBe(true);
    expect(names?.signature?.parameters).toEqual([
      { name: 'input', type: 'List<string>' },
      { name: 'extra', type: 'string[]', rest: true },
    ]);
  });

  it('nezahrne vlastnost, pole ani vnořený typ jako metodu', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).not.toContain('MAX'); // const pole
    expect(methodNames).not.toContain('Name'); // vlastnost
    expect(methodNames).not.toContain('prefix'); // pole
    expect(methodNames).not.toContain('InnerMethod'); // metoda vnořeného typu
  });

  it('mapuje interface, enum, struct, record i record struct', () => {
    const loud = graph.exports.find((e) => e.name === 'ILoud');
    expect(loud?.kind).toBe('interface');
    expect(loud?.methods?.map((m) => m.name)).toContain('Shout'); // implicitně public

    const color = graph.exports.find((e) => e.name === 'Color');
    expect(color?.kind).toBe('enum');

    const point = graph.exports.find((e) => e.name === 'Point');
    expect(point?.kind).toBe('struct');
    expect(point?.methods?.map((m) => m.name)).toContain('Sum');

    const money = graph.exports.find((e) => e.name === 'Money');
    expect(money?.kind).toBe('class'); // record → class
    expect(money?.methods?.map((m) => m.name)).toContain('Describe');

    const vec = graph.exports.find((e) => e.name === 'Vec');
    expect(vec?.kind).toBe('struct'); // record struct → struct (positional, bez těla)
  });

  it('default (internal) top-level typ je export, file-scoped a vnořený ne', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).toContain('ISpeaker'); // bez modifieru = internal → export
    expect(names).not.toContain('FileLocal'); // file-scoped
    expect(names).not.toContain('Inner'); // vnořený typ není top-level export
  });

  it('nezachytí symboly z komentářů, XML docu ani stringů', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('FakeInComment');
    expect(names).not.toContain('FakeBlock');
    expect(names).not.toContain('FakeXmlDoc');
    expect(names).not.toContain('FakeString');
    expect(names).not.toContain('FakeVerbatim');
    const allMethods = graph.exports.flatMap((e) => e.methods?.map((m) => m.name) ?? []);
    expect(allMethods).not.toContain('fakeMethod');
    expect(allMethods).not.toContain('fakeInBody');
  });
});

describe('mapCSharpFile — namespace, raw stringy a hrany', () => {
  it('file-scoped namespace: typy jsou top-level', () => {
    const src = `namespace Acme.Lib;

public class Widget
{
    public void Render() {}
}
`;
    const graph = mapCSharpFile(src, 'Widget.cs');
    const widget = graph.exports.find((e) => e.name === 'Widget');
    expect(widget?.kind).toBe('class');
    expect(widget?.methods?.map((m) => m.name)).toEqual(['Render']);
  });

  it('raw string literál (C# 11) se nesplete s deklaracemi uvnitř', () => {
    const src = `public class Raw
{
    public string Sql()
    {
        return """
            public void notAMethod() {}
            class NotAClass {}
            """;
    }
}
`;
    const graph = mapCSharpFile(src, 'Raw.cs');
    const raw = graph.exports.find((e) => e.name === 'Raw');
    expect(raw?.methods?.map((m) => m.name)).toEqual(['Sql']);
    expect(graph.exports.map((e) => e.name)).not.toContain('NotAClass');
  });

  it('char literál se středníkem nerozbije parsování členu', () => {
    const src = `public class Chars
{
    public char Sep() => ';';
    public void After() {}
}
`;
    const graph = mapCSharpFile(src, 'Chars.cs');
    const chars = graph.exports.find((e) => e.name === 'Chars');
    expect(chars?.methods?.map((m) => m.name)).toEqual(['Sep', 'After']);
  });

  it('konstruktor má parametry a žádný návratový typ', () => {
    const src = `public class C
{
    public C(int a, string b) {}
}
`;
    const graph = mapCSharpFile(src, 'C.cs');
    const ctor = graph.exports.find((e) => e.name === 'C')?.methods?.[0];
    expect(ctor?.name).toBe('C');
    expect(ctor?.signature?.parameters).toEqual([
      { name: 'a', type: 'int' },
      { name: 'b', type: 'string' },
    ]);
  });

  it('soubor bez typů má prázdné exporty', () => {
    const graph = mapCSharpFile('using System;\n', 'Empty.cs');
    expect(graph.exports).toEqual([]);
    expect(graph.imports.map((i) => i.source)).toEqual(['System']);
  });
});
