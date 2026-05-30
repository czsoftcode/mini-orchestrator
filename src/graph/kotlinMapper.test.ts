import { describe, expect, it } from 'vitest';
import { mapKotlinFile } from './kotlinMapper.js';

const FIXTURE = `// Line comment: fun fakeInComment() {}
package com.acme.app

import kotlin.math.PI
import kotlin.collections.*
import com.acme.util.Helper as Util
import com.acme.other.Thing

/* block /* vnořený */ stále komentář
fun fakeInBlock() {}
*/

/** KDoc: class FakeDoc */
const val GREETING = "fun fakeInString() {}"
val RAW = """
  fun fakeInRaw() {}
"""

fun topLevel(name: String, times: Int = 1): String {
    val c = 'x'
    return name + c
}

fun <T> identity(value: T): T = value

fun String.shout(): String = this + "!"

private fun hidden() {}

internal fun internalFn() {}

class Greeter(private val prefix: String) : Speaker {
    val name: String = "x"

    fun greet(name: String): String {
        return prefix + name
    }

    private fun secret() {}
    internal fun pkgLocal() {}
    fun expr() = 42

    class Inner {
        fun innerMethod() {}
    }
}

data class Point(val x: Int, val y: Int)

sealed class Shape

sealed interface Node

enum class Color {
    RED, GREEN, BLUE;

    fun rgb(): Int = 0
}

object Singleton {
    fun instance(): String = ""
}

annotation class Marker

interface Speaker {
    fun speak(): String
}

fun interface Worker {
    fun run()
}

abstract class Base {
    abstract fun work()
}
`;

describe('mapKotlinFile', () => {
  const graph = mapKotlinFile(FIXTURE, 'com\\acme\\app\\Greeter.kt');

  it('používá unixová lomítka v cestě', () => {
    expect(graph.path).toBe('com/acme/app/Greeter.kt');
  });

  it('zachycuje importy vč. star a as aliasu, ne package', () => {
    const pi = graph.imports.find((i) => i.source === 'kotlin.math.PI');
    expect(pi?.symbols).toEqual(['PI']);

    const star = graph.imports.find((i) => i.source === 'kotlin.collections.*');
    expect(star?.symbols).toEqual(['*']);

    const alias = graph.imports.find((i) => i.source === 'com.acme.util.Helper');
    expect(alias?.symbols).toEqual(['Util']); // as alias

    const thing = graph.imports.find((i) => i.source === 'com.acme.other.Thing');
    expect(thing?.symbols).toEqual(['Thing']);

    expect(graph.imports.some((i) => i.source.includes('com.acme.app'))).toBe(false); // package
  });

  it('nezahrne kód z komentářů ani stringů (vč. vnořeného bloku a raw stringu)', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('fakeInComment');
    expect(names).not.toContain('fakeInBlock'); // vnořený block komentář
    expect(names).not.toContain('FakeDoc');
    expect(names).not.toContain('fakeInString');
    expect(names).not.toContain('fakeInRaw'); // raw string
    // top-level val/const se nemapují jako export
    expect(names).not.toContain('GREETING');
    expect(names).not.toContain('RAW');
  });

  it('mapuje top-level fun se signaturou a kotvami', () => {
    const fn = graph.exports.find((e) => e.name === 'topLevel');
    expect(fn?.kind).toBe('function');
    expect(fn?.line).toBeDefined();
    expect(fn?.endLine).toBeDefined();
    expect(fn!.endLine!).toBeGreaterThan(fn!.line!);
    expect(fn?.signature?.parameters).toEqual([
      { name: 'name', type: 'String' },
      { name: 'times', type: 'Int', optional: true },
    ]);
    expect(fn?.signature?.returnType).toBe('String');
  });

  it('zvládne generika, výrazové tělo i extension receiver', () => {
    const identity = graph.exports.find((e) => e.name === 'identity');
    expect(identity?.kind).toBe('function');
    expect(identity?.signature?.parameters).toEqual([{ name: 'value', type: 'T' }]);
    expect(identity?.signature?.returnType).toBe('T');

    const shout = graph.exports.find((e) => e.name === 'shout'); // fun String.shout()
    expect(shout?.kind).toBe('function');
    expect(shout?.signature?.returnType).toBe('String');
  });

  it('vynechá private i internal top-level fun', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('hidden'); // private
    expect(names).not.toContain('internalFn'); // internal
  });

  it('mapuje class s viditelnými metodami, vynechá private/internal/vnořené', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.kind).toBe('class');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toContain('greet');
    expect(methodNames).toContain('expr'); // výrazové tělo
    expect(methodNames).not.toContain('secret'); // private
    expect(methodNames).not.toContain('pkgLocal'); // internal
    expect(methodNames).not.toContain('name'); // vlastnost
    expect(methodNames).not.toContain('innerMethod'); // metoda vnořeného typu

    const greet = greeter?.methods?.find((m) => m.name === 'greet');
    expect(greet?.signature?.parameters).toEqual([{ name: 'name', type: 'String' }]);
    expect(greet?.signature?.returnType).toBe('String');
  });

  it('mapuje data class bez těla s kotvami', () => {
    const point = graph.exports.find((e) => e.name === 'Point');
    expect(point?.kind).toBe('class');
    expect(point?.line).toBeDefined();
    expect(point?.endLine).toBeDefined();
    expect(point?.methods).toBeUndefined();
  });

  it('rozliší enum class, object, interface, fun interface, sealed i annotation class', () => {
    const color = graph.exports.find((e) => e.name === 'Color');
    expect(color?.kind).toBe('enum');
    expect(color?.methods?.map((m) => m.name)).toContain('rgb');

    const singleton = graph.exports.find((e) => e.name === 'Singleton');
    expect(singleton?.kind).toBe('class'); // object
    expect(singleton?.methods?.map((m) => m.name)).toContain('instance');

    const speaker = graph.exports.find((e) => e.name === 'Speaker');
    expect(speaker?.kind).toBe('interface');
    expect(speaker?.methods?.map((m) => m.name)).toContain('speak'); // implicitně public

    const worker = graph.exports.find((e) => e.name === 'Worker');
    expect(worker?.kind).toBe('interface'); // fun interface
    expect(worker?.methods?.map((m) => m.name)).toContain('run');

    const shape = graph.exports.find((e) => e.name === 'Shape');
    expect(shape?.kind).toBe('class'); // sealed class

    const node = graph.exports.find((e) => e.name === 'Node');
    expect(node?.kind).toBe('interface'); // sealed interface

    const marker = graph.exports.find((e) => e.name === 'Marker');
    expect(marker?.kind).toBe('class'); // annotation class

    const base = graph.exports.find((e) => e.name === 'Base');
    expect(base?.kind).toBe('class');
    expect(base?.methods?.map((m) => m.name)).toContain('work'); // abstract fun bez těla
  });

  it('kotvy ukazují na správné řádky deklarací', () => {
    const lines = FIXTURE.split('\n');
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    // řádky jsou 1-based
    expect(lines[greeter!.line! - 1]).toContain('class Greeter');
    expect(lines[greeter!.endLine! - 1]).toBe('}');
  });

  it('parsuje vararg a default parametry', () => {
    const src = `fun build(prefix: String = "x", vararg parts: Int): String = ""`;
    const g = mapKotlinFile(src, 'B.kt');
    const fn = g.exports.find((e) => e.name === 'build');
    expect(fn?.signature?.parameters).toEqual([
      { name: 'prefix', type: 'String', optional: true },
      { name: 'parts', type: 'Int', rest: true },
    ]);
  });
});
