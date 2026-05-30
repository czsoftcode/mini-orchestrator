import { describe, expect, it } from 'vitest';
import { mapGoFile } from './goMapper.js';

const FIXTURE = `// Package fixture demonstruje mapování.
package fixture

import "fmt"
import (
	"strings"
	r "math/rand"
	_ "image/png"
	. "errors"
)

/* block komentář:
func FakeInComment() {}
type FakeStruct struct{}
*/

const MaxSize = 100
const lowercase = 5

const (
	StatusOK   = 200
	statusHide = 0
	A, B       = 1, 2
)

var Logger = fmt.Println
var hidden = 3

var (
	Version  string = "1.0"
	internal int
)

type Color int

type Greeter struct {
	Name string
}

type Speaker interface {
	Speak() string
}

func Greet(name string, count int) string {
	msg := "func StringFake() {}"
	return msg
}

func variadicSum(nums ...int) (total int) {
	return
}

func unexported() {}

func (g *Greeter) Hello(loud bool) (string, error) {
	raw := \`func RawFake() {}\`
	return g.Name, nil
}

func (g Greeter) secret() string { return g.Name }

func Multi(a, b int, names ...string) {
}
`;

describe('mapGoFile', () => {
  const graph = mapGoFile(FIXTURE, 'pkg\\app.go');

  it('používá unixová lomítka v cestě', () => {
    expect(graph.path).toBe('pkg/app.go');
  });

  it('zachycuje single i blokový import vč. aliasu, _ a tečky', () => {
    const fmtImp = graph.imports.find((i) => i.source === 'fmt');
    expect(fmtImp?.symbols).toEqual(['fmt']);

    const strings = graph.imports.find((i) => i.source === 'strings');
    expect(strings?.symbols).toEqual(['strings']);

    const rand = graph.imports.find((i) => i.source === 'math/rand');
    expect(rand?.symbols).toEqual(['r']); // alias

    const png = graph.imports.find((i) => i.source === 'image/png');
    expect(png?.symbols).toEqual([]); // _ blank import → side-effect

    const errs = graph.imports.find((i) => i.source === 'errors');
    expect(errs?.symbols).toEqual(['*']); // . dot import
  });

  it('zachycuje top-level exportovanou funkci se signaturou', () => {
    const greet = graph.exports.find((e) => e.name === 'Greet');
    expect(greet?.kind).toBe('function');
    expect(greet?.signature?.parameters).toEqual([
      { name: 'name', type: 'string' },
      { name: 'count', type: 'int' },
    ]);
    expect(greet?.signature?.returnType).toBe('string');
  });

  it('řeší sdílený typ a variadic parametry', () => {
    const multi = graph.exports.find((e) => e.name === 'Multi');
    expect(multi?.signature?.parameters).toEqual([
      { name: 'a', type: 'int' },
      { name: 'b', type: 'int' },
      { name: 'names', type: 'string', rest: true },
    ]);
    expect(multi?.signature?.returnType).toBeUndefined();
  });

  it('neexportuje funkce s malým počátečním písmenem', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('unexported');
    expect(names).not.toContain('variadicSum');
  });

  it('mapuje struct a interface, metodu připojí k receiver typu', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.kind).toBe('struct');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toEqual(['Hello']); // secret je unexported
    const hello = greeter?.methods?.find((m) => m.name === 'Hello');
    expect(hello?.signature?.parameters).toEqual([{ name: 'loud', type: 'bool' }]);
    expect(hello?.signature?.returnType).toBe('(string, error)');

    const speaker = graph.exports.find((e) => e.name === 'Speaker');
    expect(speaker?.kind).toBe('interface');

    const color = graph.exports.find((e) => e.name === 'Color');
    expect(color?.kind).toBe('type');
  });

  it('zachycuje exportované const/var vč. seskupených, ostatní ignoruje', () => {
    const consts = graph.exports.filter((e) => e.kind === 'const').map((e) => e.name);
    expect(consts).toContain('MaxSize');
    expect(consts).toContain('StatusOK');
    expect(consts).toContain('A');
    expect(consts).toContain('B');
    expect(consts).not.toContain('lowercase');
    expect(consts).not.toContain('statusHide');

    const vars = graph.exports.filter((e) => e.kind === 'variable').map((e) => e.name);
    expect(vars).toContain('Logger');
    expect(vars).toContain('Version');
    expect(vars).not.toContain('hidden');
    expect(vars).not.toContain('internal');
  });

  it('nezachytí symboly z komentářů, stringů ani raw stringů', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('FakeInComment');
    expect(names).not.toContain('FakeStruct');
    expect(names).not.toContain('StringFake');
    expect(names).not.toContain('RawFake');
  });

  it('endLine pokrývá víceřádkové tělo funkce', () => {
    const greet = graph.exports.find((e) => e.name === 'Greet');
    expect(greet?.line).toBeDefined();
    expect(greet?.endLine).toBeDefined();
    expect(greet!.endLine!).toBeGreaterThan(greet!.line!);
  });
});
