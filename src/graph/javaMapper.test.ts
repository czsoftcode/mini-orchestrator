import { describe, expect, it } from 'vitest';
import { mapJavaFile } from './javaMapper.js';

const FIXTURE = `// Comment se class FakeInComment {} nepočítá
package com.example.app;

import java.util.List;
import java.util.Map;
import static java.util.Collections.emptyList;
import com.example.util.*;

/* block komentář:
class FakeBlock {}
public void fakeMethod() {}
*/

/**
 * Javadoc: class FakeJavadoc {}
 */
@Service
@Deprecated
public final class Greeter implements Speaker {
    private final String prefix = "public class FakeString {}";
    public static final int MAX = 100;
    protected long count;

    public Greeter(String prefix) {
        this.prefix = prefix;
    }

    @Override
    public String greet(String name, int times) {
        String s = "void fakeInBody() {}";
        return prefix + name;
    }

    protected static List<String> names(List<String> input, String... extra) {
        return input;
    }

    private void hidden() {}

    public class Inner {
        public void innerMethod() {}
    }
}

interface Speaker {
    String speak();
}

public interface Loud {
    default void shout() {}
    void whisper(String msg);
}

public enum Color {
    RED, GREEN, BLUE;

    public String hex() { return ""; }
}

public record Point(int x, int y) {
    public int sum() { return x + y; }
}

class PackagePrivate {
    public void shouldNotExport() {}
}
`;

describe('mapJavaFile', () => {
  const graph = mapJavaFile(FIXTURE, 'com\\example\\app\\Greeter.java');

  it('používá unixová lomítka v cestě', () => {
    expect(graph.path).toBe('com/example/app/Greeter.java');
  });

  it('zachycuje import, static import i wildcard', () => {
    const list = graph.imports.find((i) => i.source === 'java.util.List');
    expect(list?.symbols).toEqual(['List']);

    const empty = graph.imports.find((i) => i.source === 'java.util.Collections.emptyList');
    expect(empty?.symbols).toEqual(['emptyList']); // static import

    const wildcard = graph.imports.find((i) => i.source === 'com.example.util.*');
    expect(wildcard?.symbols).toEqual(['*']);
  });

  it('nezahrne package deklaraci do importů', () => {
    expect(graph.imports.some((i) => i.source.includes('com.example.app'))).toBe(false);
  });

  it('mapuje public class s kotvami a kindem', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.kind).toBe('class');
    expect(greeter?.line).toBeDefined();
    expect(greeter?.endLine).toBeDefined();
    expect(greeter!.endLine!).toBeGreaterThan(greeter!.line!);
  });

  it('připojí public/protected metody k typu se signaturou', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toContain('greet');
    expect(methodNames).toContain('names');
    expect(methodNames).toContain('Greeter'); // konstruktor
    expect(methodNames).not.toContain('hidden'); // private

    const greet = greeter?.methods?.find((m) => m.name === 'greet');
    expect(greet?.signature?.parameters).toEqual([
      { name: 'name', type: 'String' },
      { name: 'times', type: 'int' },
    ]);

    const names = greeter?.methods?.find((m) => m.name === 'names');
    expect(names?.isStatic).toBe(true);
    expect(names?.signature?.parameters).toEqual([
      { name: 'input', type: 'List<String>' },
      { name: 'extra', type: 'String', rest: true },
    ]);
  });

  it('nezahrne pole ani vnořený typ jako metodu', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).not.toContain('MAX');
    expect(methodNames).not.toContain('prefix');
    expect(methodNames).not.toContain('count');
    // metoda vnořené třídy nesmí prosáknout do vnějšího typu
    expect(methodNames).not.toContain('innerMethod');
  });

  it('mapuje interface, enum i record', () => {
    const loud = graph.exports.find((e) => e.name === 'Loud');
    expect(loud?.kind).toBe('interface');
    const loudMethods = loud?.methods?.map((m) => m.name) ?? [];
    expect(loudMethods).toContain('shout'); // default metoda
    expect(loudMethods).toContain('whisper'); // abstraktní (bez těla)

    const color = graph.exports.find((e) => e.name === 'Color');
    expect(color?.kind).toBe('enum');
    expect(color?.methods?.map((m) => m.name)).toContain('hex');

    const point = graph.exports.find((e) => e.name === 'Point');
    expect(point?.kind).toBe('class'); // record → class
    expect(point?.methods?.map((m) => m.name)).toContain('sum');
  });

  it('neexportuje package-private ani vnořené typy jako top-level', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('Speaker'); // package-private interface
    expect(names).not.toContain('PackagePrivate');
    expect(names).not.toContain('Inner'); // vnořený typ není top-level export
  });

  it('nezachytí symboly z komentářů, javadocu ani stringů', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('FakeInComment');
    expect(names).not.toContain('FakeBlock');
    expect(names).not.toContain('FakeJavadoc');
    expect(names).not.toContain('FakeString');
    const allMethods = graph.exports.flatMap((e) => e.methods?.map((m) => m.name) ?? []);
    expect(allMethods).not.toContain('fakeMethod');
    expect(allMethods).not.toContain('fakeInBody');
  });
});

describe('mapJavaFile — text bloky a hrany', () => {
  it('text block (Java 15+) se nesplete s deklaracemi uvnitř', () => {
    const src = `public class TextBlocks {
    public String sql() {
        return """
            public void notAMethod() {}
            class NotAClass {}
            """;
    }
}
`;
    const graph = mapJavaFile(src, 'TextBlocks.java');
    const tb = graph.exports.find((e) => e.name === 'TextBlocks');
    const methods = tb?.methods?.map((m) => m.name) ?? [];
    expect(methods).toEqual(['sql']);
    expect(methods).not.toContain('notAMethod');
  });

  it('konstruktor má prázdný návratový typ a parametry', () => {
    const src = `public class C {
    public C(int a, String b) {}
}
`;
    const graph = mapJavaFile(src, 'C.java');
    const ctor = graph.exports.find((e) => e.name === 'C')?.methods?.find((m) => m.name === 'C');
    expect(ctor?.signature?.returnType).toBeUndefined();
    expect(ctor?.signature?.parameters).toEqual([
      { name: 'a', type: 'int' },
      { name: 'b', type: 'String' },
    ]);
  });

  it('non-sealed třída se rozpozná jako public class', () => {
    const src = `public non-sealed class Sub extends Base {
    public void run() {}
}
`;
    const graph = mapJavaFile(src, 'Sub.java');
    const sub = graph.exports.find((e) => e.name === 'Sub');
    expect(sub?.kind).toBe('class');
    expect(sub?.methods?.map((m) => m.name)).toEqual(['run']);
  });
});
