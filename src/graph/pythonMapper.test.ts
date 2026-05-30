import { describe, expect, it } from 'vitest';
import { mapPythonFile } from './pythonMapper.js';

const FIXTURE = `"""Modulový docstring.

V něm: def fake_in_docstring(): pass  a  class FakeDoc: pass  a  # fake komentář
"""
import os
import os.path as p
import collections.abc
from typing import List, Dict as D, Optional
from . import sibling
from ..pkg import thing as renamed
from .utils import (
    helper_a,
    helper_b,
)
from glob import *

MAX_SIZE = 100
default_timeout: int = 30
lowercase_skipped = 5
_private_const = 1

@decorator
@another.deco(arg=1)
def greet(name: str, count: int = 1, *args, **kwargs) -> str:
    # def hidden_in_body(): pass
    msg = "def string_fake(): pass"
    return msg * count

async def fetch(url: str) -> bytes:
    return b""

def _private_fn():
    pass

class Greeter:
    """Třída.

    class FakeNested: pass
    """

    GREETING: str = "ahoj"

    def __init__(self, name: str):
        self.name = name

    def hello(self, loud: bool = False) -> str:
        def inner():
            return 1
        return self.name

    @staticmethod
    def make(raw: str) -> "Greeter":
        return Greeter(raw)

    def _secret(self):
        pass


def trailing(
    a,
    b,
):
    return a + b
`;

describe('mapPythonFile', () => {
  const graph = mapPythonFile(FIXTURE, 'src/app.py');

  it('používá unixová lomítka v cestě', () => {
    expect(graph.path).toBe('src/app.py');
  });

  it('zachycuje import i import ... as', () => {
    const os = graph.imports.find((i) => i.source === 'os');
    expect(os?.symbols).toEqual(['os']);
    const aliased = graph.imports.find((i) => i.source === 'os.path');
    expect(aliased?.symbols).toEqual(['p']);
    const dotted = graph.imports.find((i) => i.source === 'collections.abc');
    expect(dotted?.symbols).toEqual(['abc']);
  });

  it('zachycuje from ... import vč. aliasů, relativních a hvězdičky', () => {
    const typing = graph.imports.find((i) => i.source === 'typing');
    expect(typing?.symbols).toEqual(['List', 'D', 'Optional']);

    const sibling = graph.imports.find((i) => i.source === '.');
    expect(sibling?.symbols).toEqual(['sibling']);

    const parent = graph.imports.find((i) => i.source === '..pkg');
    expect(parent?.symbols).toEqual(['renamed']);

    const star = graph.imports.find((i) => i.source === 'glob');
    expect(star?.symbols).toEqual(['*']);
  });

  it('spojí víceřádkový from ... import v závorkách', () => {
    const utils = graph.imports.find((i) => i.source === '.utils');
    expect(utils?.symbols).toEqual(['helper_a', 'helper_b']);
  });

  it('zachycuje top-level def se signaturou a dekorátory v kotvě', () => {
    const greet = graph.exports.find((e) => e.name === 'greet');
    expect(greet?.kind).toBe('function');
    expect(greet?.signature?.parameters).toEqual([
      { name: 'name', type: 'str' },
      { name: 'count', type: 'int', optional: true },
      { name: 'args', rest: true },
      { name: 'kwargs', rest: true },
    ]);
    expect(greet?.signature?.returnType).toBe('str');
    // kotva (line) ukazuje na první dekorátor, ne na řádek `def`
    const decoLine = FIXTURE.split('\n').findIndex((l) => l === '@decorator') + 1;
    expect(greet?.line).toBe(decoLine);
  });

  it('zachycuje async def jako function', () => {
    const fetch = graph.exports.find((e) => e.name === 'fetch');
    expect(fetch?.kind).toBe('function');
    expect(fetch?.signature?.returnType).toBe('bytes');
  });

  it('zachycuje class a její veřejné metody (mimo _ a vnořené def)', () => {
    const cls = graph.exports.find((e) => e.name === 'Greeter');
    expect(cls?.kind).toBe('class');
    const methodNames = cls?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toEqual(['hello', 'make']);
    expect(methodNames).not.toContain('__init__'); // _ prefix
    expect(methodNames).not.toContain('_secret');
    expect(methodNames).not.toContain('inner'); // vnořený def

    const make = cls?.methods?.find((m) => m.name === 'make');
    expect(make?.isStatic).toBe(true);
    expect(make?.signature?.parameters).toEqual([{ name: 'raw', type: 'str' }]);

    const hello = cls?.methods?.find((m) => m.name === 'hello');
    // self se vynechá
    expect(hello?.signature?.parameters).toEqual([{ name: 'loud', type: 'bool', optional: true }]);
  });

  it('zachycuje UPPER_CASE a anotované konstanty, ostatní ignoruje', () => {
    const names = graph.exports.filter((e) => e.kind === 'const').map((e) => e.name);
    expect(names).toContain('MAX_SIZE');
    expect(names).toContain('default_timeout'); // má anotaci
    expect(names).not.toContain('lowercase_skipped'); // lowercase bez anotace
    expect(names).not.toContain('_private_const');
  });

  it('neexportuje _private funkce ani nic z docstringů/komentářů/stringů', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('_private_fn');
    expect(names).not.toContain('fake_in_docstring');
    expect(names).not.toContain('FakeDoc');
    expect(names).not.toContain('FakeNested');
    expect(names).not.toContain('hidden_in_body');
    expect(names).not.toContain('string_fake');
  });

  it('endLine pokrývá víceřádkové hlavičky i tělo', () => {
    const trailing = graph.exports.find((e) => e.name === 'trailing');
    expect(trailing?.line).toBeDefined();
    expect(trailing?.endLine).toBeDefined();
    expect(trailing!.endLine!).toBeGreaterThan(trailing!.line!);
  });
});
