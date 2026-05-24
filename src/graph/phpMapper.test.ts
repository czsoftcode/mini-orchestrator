import { describe, expect, it } from 'vitest';
import { mapPhpFile } from './phpMapper.js';

const FIXTURE = `<?php

namespace App\\Service;

use App\\Foo\\Bar;
use App\\Helpers\\Stringer as Str;
use App\\Helpers\\{Alpha, Beta as B};

/**
 * Komentář s klamavým slovem: use Fake\\Thing;
 */
class Greeter
{
    public function __construct(private readonly string $prefix) {}

    public function greet(string $name, ?int $loud = 0): string
    {
        // tady je use $local; uvnitř — nesmí se chytit
        $f = function () use ($name) {
            return $name;
        };
        return $this->prefix . $name;
    }

    public static function create(): self
    {
        return new self('');
    }

    private function secret(): void {}
}

interface Talker
{
    public function talk(): string;
}

trait Loud
{
    public function shout(): string { return 'HEY'; }
}

function topLevel(string $a, int ...$rest): bool
{
    return true;
}
`;

describe('mapPhpFile', () => {
  const graph = mapPhpFile(FIXTURE, 'app/Service/Greeter.php');

  it('uses unix-slash path', () => {
    expect(graph.path).toBe('app/Service/Greeter.php');
  });

  it('zachycuje top-level use statements', () => {
    const sources = graph.imports.map((i) => i.source);
    expect(sources).toContain('App\\Foo\\Bar');
    expect(sources).toContain('App\\Helpers\\Stringer');
    expect(sources).toContain('App\\Helpers');
    expect(sources).not.toContain('Fake\\Thing'); // komentář
  });

  it('rozloží alias a group use', () => {
    const aliased = graph.imports.find((i) => i.source === 'App\\Helpers\\Stringer');
    expect(aliased?.symbols).toEqual(['Str']);

    const group = graph.imports.find((i) => i.source === 'App\\Helpers');
    expect(group?.symbols).toEqual(['Alpha', 'B']);
  });

  it('ignoruje use uvnitř těla metody (closure)', () => {
    const localUse = graph.imports.find((i) => i.source.includes('local'));
    expect(localUse).toBeUndefined();
  });

  it('zachycuje class s veřejnými metodami (ne private)', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.kind).toBe('class');
    const methodNames = greeter?.methods?.map((m) => m.name) ?? [];
    expect(methodNames).toContain('greet');
    expect(methodNames).toContain('create');
    expect(methodNames).toContain('__construct');
    expect(methodNames).not.toContain('secret');

    const greet = greeter?.methods?.find((m) => m.name === 'greet');
    expect(greet?.signature.parameters).toEqual([
      { name: 'name', type: 'string' },
      { name: 'loud', type: '?int', optional: true },
    ]);
    expect(greet?.signature.returnType).toBe('string');

    const create = greeter?.methods?.find((m) => m.name === 'create');
    expect(create?.isStatic).toBe(true);
    expect(create?.signature.returnType).toBe('self');
  });

  it('zachycuje interface a trait', () => {
    expect(graph.exports.find((e) => e.name === 'Talker')?.kind).toBe('interface');
    expect(graph.exports.find((e) => e.name === 'Loud')?.kind).toBe('trait');
  });

  it('zachycuje top-level funkci se signaturou', () => {
    const fn = graph.exports.find((e) => e.name === 'topLevel');
    expect(fn?.kind).toBe('function');
    expect(fn?.signature?.parameters).toEqual([
      { name: 'a', type: 'string' },
      { name: 'rest', type: 'int', rest: true },
    ]);
    expect(fn?.signature?.returnType).toBe('bool');
  });

  it('negativní fixtury: nezachytí class/use/function ze stringů a komentářů', () => {
    const out = mapPhpFile(
      `<?php
// class FakeClass {}
# use FakeNs\\Fake;
/* class StillFake {} interface Hidden {} */
$x = 'use Stringy\\Fake;';
$y = "class Inside {}";
$heredoc = <<<EOT
class Heredocked {}
function fake_inside() {}
use Heredoc\\Ns;
EOT;
$nowdoc = <<<'EOT'
class NowdocClass {}
EOT;

class Real {}
function real(): void {}
`,
      'src/neg.php',
    );

    const exportNames = out.exports.map((e) => e.name);
    expect(exportNames).toEqual(expect.arrayContaining(['Real', 'real']));
    expect(exportNames).not.toContain('FakeClass');
    expect(exportNames).not.toContain('StillFake');
    expect(exportNames).not.toContain('Hidden');
    expect(exportNames).not.toContain('Inside');
    expect(exportNames).not.toContain('Heredocked');
    expect(exportNames).not.toContain('fake_inside');
    expect(exportNames).not.toContain('NowdocClass');

    const importSources = out.imports.map((i) => i.source);
    expect(importSources).not.toContain('FakeNs\\Fake');
    expect(importSources).not.toContain('Stringy\\Fake');
    expect(importSources).not.toContain('Heredoc\\Ns');
  });

  it('prázdný soubor produkuje prázdný graf', () => {
    const out = mapPhpFile(`<?php\n`, 'src/empty.php');
    expect(out.exports).toEqual([]);
    expect(out.imports).toEqual([]);
  });
});
