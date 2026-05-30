import { describe, expect, it } from 'vitest';
import { mapRustFile } from './rustMapper.js';

const FIXTURE = `
//! Crate-level dokumentace
use std::collections::HashMap;
use std::fmt::{self, Display, Debug as Dbg};
use crate::utils::*;
use crate::helpers::strip as cleanup;

/// Doc komentář pro Greeter.
/// V něm: pub fn fake() {}
pub struct Greeter {
    pub name: String,
    private_field: u32,
}

pub enum Mode {
    Slow,
    Fast,
}

pub trait Talker {
    fn talk(&self) -> String;
}

pub(crate) fn run(prefix: &str, count: u32) -> Result<String, std::io::Error> {
    // uvnitř funkce: pub fn hidden() {}
    Ok(format!("{prefix}-{count}"))
}

pub fn empty_ret() {
    let _s = "pub fn from_string() {}";
    let _r = r#"pub fn from_raw() {}"#;
}

fn private_helper() -> bool {
    true
}

impl Greeter {
    pub fn new(name: String) -> Self {
        // pub fn impl_method() — uvnitř impl bloku, nesmí se zachytit
        Self { name, private_field: 0 }
    }
}

/* block comment:
   pub fn hidden_block() {}
   /* nested:
      pub struct Nested;
   */
*/
`;

describe('mapRustFile', () => {
  const graph = mapRustFile(FIXTURE, 'src/lib.rs');

  it('uses unix-slash path', () => {
    expect(graph.path).toBe('src/lib.rs');
  });

  it('zachycuje use statements včetně group, aliasu a glob', () => {
    const sources = graph.imports.map((i) => i.source);
    expect(sources).toContain('std::collections::HashMap');
    expect(sources).toContain('std::fmt');
    expect(sources).toContain('crate::utils');
    expect(sources).toContain('crate::helpers::strip');

    const group = graph.imports.find((i) => i.source === 'std::fmt');
    expect(group?.symbols).toEqual(['fmt', 'Display', 'Dbg']);

    const glob = graph.imports.find((i) => i.source === 'crate::utils');
    expect(glob?.symbols).toEqual(['*']);

    const aliased = graph.imports.find((i) => i.source === 'crate::helpers::strip');
    expect(aliased?.symbols).toEqual(['cleanup']);
  });

  it('zachycuje pub struct/enum/trait', () => {
    expect(graph.exports.find((e) => e.name === 'Greeter')?.kind).toBe('struct');
    expect(graph.exports.find((e) => e.name === 'Mode')?.kind).toBe('enum');
    expect(graph.exports.find((e) => e.name === 'Talker')?.kind).toBe('trait');
  });

  it('zachycuje pub fn a pub(crate) fn se signaturou', () => {
    const run = graph.exports.find((e) => e.name === 'run');
    expect(run?.kind).toBe('function');
    expect(run?.signature?.parameters).toEqual([
      { name: 'prefix', type: '&str' },
      { name: 'count', type: 'u32' },
    ]);
    expect(run?.signature?.returnType).toBe('Result<String, std::io::Error>');

    const empty = graph.exports.find((e) => e.name === 'empty_ret');
    expect(empty?.kind).toBe('function');
    expect(empty?.signature?.parameters).toEqual([]);
  });

  it('nezachycuje private fn ani fn v impl bloku', () => {
    const names = graph.exports.map((e) => e.name);
    expect(names).not.toContain('private_helper');
    expect(names).not.toContain('new'); // pub fn new uvnitř impl
    expect(names).not.toContain('fake'); // v doc komentáři
    expect(names).not.toContain('hidden'); // v běžném komentáři
    expect(names).not.toContain('from_string'); // v stringu
    expect(names).not.toContain('from_raw'); // v raw stringu
    expect(names).not.toContain('hidden_block'); // v block komentáři
    expect(names).not.toContain('Nested'); // vnořený block komentář
  });

  it('negativní fixtura: stringy, raw stringy, vnořené komentáře, lifetimes', () => {
    const out = mapRustFile(
      `
// pub fn line_fake() {}
/* pub struct BlockFake; /* pub enum InnerFake {} */ */

pub fn echo<'a, T>(x: &'a T) -> &'a T where T: Clone { x }
pub struct Real;

const A: &str = "pub fn quoted() {}";
const B: &str = r##"pub trait RawTrait { fn x(); }"##;
const C: char = '}';
`,
      'src/neg.rs',
    );
    const names = out.exports.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['echo', 'Real']));
    expect(names).not.toContain('line_fake');
    expect(names).not.toContain('BlockFake');
    expect(names).not.toContain('InnerFake');
    expect(names).not.toContain('quoted');
    expect(names).not.toContain('RawTrait');

    const echo = out.exports.find((e) => e.name === 'echo');
    expect(echo?.signature?.parameters).toEqual([{ name: 'x', type: "&'a T" }]);
    expect(echo?.signature?.returnType).toBe("&'a T");
  });

  it('zachycuje rozsah řádků deklarací (1-based)', () => {
    const greeter = graph.exports.find((e) => e.name === 'Greeter');
    expect(greeter?.line).toBe(10);
    expect(greeter?.endLine).toBe(13);

    const talker = graph.exports.find((e) => e.name === 'Talker');
    expect(talker?.line).toBe(20);
    expect(talker?.endLine).toBe(22);

    const run = graph.exports.find((e) => e.name === 'run');
    expect(run?.line).toBe(24);
    expect(run?.endLine).toBe(27);
  });

  it('prázdný soubor produkuje prázdný graf', () => {
    const out = mapRustFile('', 'src/empty.rs');
    expect(out.exports).toEqual([]);
    expect(out.imports).toEqual([]);
  });
});
