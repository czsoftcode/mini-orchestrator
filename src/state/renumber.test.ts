import { describe, expect, it } from 'vitest';
import {
  buildRenumberMap,
  findCollisions,
  parsePhaseFile,
  planMemoryDir,
  planSimpleDir,
} from './renumber.js';

describe('parsePhaseFile', () => {
  it('paddované .json', () => {
    expect(parsePhaseFile('phase-001.json')).toEqual({
      id: 1,
      idStr: '001',
      ext: 'json',
      isPrev: false,
      rest: null,
    });
  });

  it('nepaddované .md', () => {
    expect(parsePhaseFile('phase-1.md')).toMatchObject({ id: 1, idStr: '1', ext: 'md', isPrev: false });
  });

  it('desetinné id', () => {
    expect(parsePhaseFile('phase-1.1.json')).toMatchObject({ id: 1.1, idStr: '1.1', ext: 'json' });
    expect(parsePhaseFile('phase-12.1.md')).toMatchObject({ id: 12.1, idStr: '12.1', ext: 'md' });
  });

  it('run .prev.md', () => {
    expect(parsePhaseFile('phase-1.1.prev.md')).toMatchObject({ id: 1.1, isPrev: true, ext: 'md' });
    expect(parsePhaseFile('phase-18.1.prev.md')).toMatchObject({ id: 18.1, isPrev: true });
  });

  it('memory s ISO timestampem — id se oddělí od zbytku', () => {
    const p = parsePhaseFile('phase-1.1-2026-05-25T13-05-39.777Z.md');
    expect(p).toMatchObject({ id: 1.1, idStr: '1.1', ext: 'md', rest: '2026-05-25T13-05-39.777Z' });
  });

  it('memory historický index', () => {
    expect(parsePhaseFile('phase-001-2.md')).toMatchObject({ id: 1, idStr: '001', rest: '2' });
  });

  it('nesoubory fáze → null', () => {
    expect(parsePhaseFile('README.md')).toBeNull();
    expect(parsePhaseFile('phase-.md')).toBeNull();
    expect(parsePhaseFile('state.json')).toBeNull();
  });
});

describe('buildRenumberMap', () => {
  it('nové id = pozice + 1 (souvislé 1..N)', () => {
    const map = buildRenumberMap([{ id: 1 }, { id: 1.1 }, { id: 2.1 }, { id: 29 }, { id: 30 }]);
    expect([...map.entries()]).toEqual([
      [1, 1],
      [1.1, 2],
      [2.1, 3],
      [29, 4],
      [30, 5],
    ]);
  });

  it('Symfony rozsah 1..31 — 28.1→29, 29→30, 30→31', () => {
    const phases = [{ id: 1 }, ...Array.from({ length: 28 }, (_, i) => ({ id: i + 1 + 0.1 })), { id: 29 }, { id: 30 }];
    const map = buildRenumberMap(phases);
    expect(map.get(1)).toBe(1);
    expect(map.get(1.1)).toBe(2);
    expect(map.get(28.1)).toBe(29);
    expect(map.get(29)).toBe(30);
    expect(map.get(30)).toBe(31);
    expect(map.size).toBe(31);
  });
});

describe('planSimpleDir', () => {
  const idMap = buildRenumberMap([{ id: 1 }, { id: 1.1 }, { id: 29 }, { id: 30 }]);
  // → 1:1, 1.1:2, 29:3, 30:4

  it('padduje a přečísluje .json', () => {
    const plan = planSimpleDir(['phase-001.json', 'phase-1.1.json', 'phase-029.json', 'phase-030.json'], idMap);
    expect(plan.renames).toEqual([
      // phase-001.json → phase-001.json (beze změny, vynecháno)
      { from: 'phase-1.1.json', to: 'phase-002.json' },
      { from: 'phase-029.json', to: 'phase-003.json' },
      { from: 'phase-030.json', to: 'phase-004.json' },
    ]);
    expect(plan.orphans).toEqual([]);
  });

  it('nepaddované .md a .prev.md', () => {
    const plan = planSimpleDir(['phase-1.md', 'phase-1.1.prev.md', 'phase-30.md'], idMap);
    expect(plan.renames).toEqual([
      { from: 'phase-1.md', to: 'phase-001.md' },
      { from: 'phase-1.1.prev.md', to: 'phase-002.prev.md' },
      { from: 'phase-30.md', to: 'phase-004.md' },
    ]);
  });

  it('id mimo stav → orphan, neignoruje nesoubory', () => {
    const plan = planSimpleDir(['phase-999.md', 'README.md'], idMap);
    expect(plan.renames).toEqual([]);
    expect(plan.orphans).toEqual(['phase-999.md']);
  });
});

describe('planMemoryDir', () => {
  const idMap = buildRenumberMap([{ id: 1 }, { id: 1.1 }, { id: 2.1 }]);
  // → 1:1, 1.1:2, 2.1:3

  it('zahodí timestamp, jeden soubor na fázi', () => {
    const plan = planMemoryDir(
      ['phase-1.1-2026-05-25T13-05-39.777Z.md', 'phase-2.1-2026-05-25T14-03-43.861Z.md'],
      idMap,
    );
    expect(plan.renames).toEqual([
      { from: 'phase-1.1-2026-05-25T13-05-39.777Z.md', to: 'phase-002.md' },
      { from: 'phase-2.1-2026-05-25T14-03-43.861Z.md', to: 'phase-003.md' },
    ]);
  });

  it('víc souborů na fázi → historie -2/-3 podle pořadí timestampů', () => {
    const plan = planMemoryDir(
      [
        'phase-1.1-2026-05-25T18-00-00.000Z.md',
        'phase-1.1-2026-05-25T13-00-00.000Z.md',
        'phase-1.1-2026-05-25T15-00-00.000Z.md',
      ],
      idMap,
    );
    const targets = plan.renames.map((r) => r.to).sort();
    expect(targets).toEqual(['phase-002-2.md', 'phase-002-3.md', 'phase-002.md']);
    // nejstarší timestamp → základní název
    expect(plan.renames.find((r) => r.from.includes('13-00-00'))?.to).toBe('phase-002.md');
    expect(plan.renames.find((r) => r.from.includes('18-00-00'))?.to).toBe('phase-002-3.md');
  });
});

describe('findCollisions', () => {
  it('žádná kolize', () => {
    expect(
      findCollisions([{ from: 'phase-029.json', to: 'phase-003.json' }], ['phase-029.json', 'phase-030.json']),
    ).toEqual([]);
  });

  it('dva zdroje na stejný cíl', () => {
    const col = findCollisions(
      [
        { from: 'phase-1.md', to: 'phase-001.md' },
        { from: 'phase-001.md', to: 'phase-001.md' },
      ],
      [],
    );
    expect(col).toContain('phase-001.md');
  });

  it('cíl obsazený nepřejmenovávaným souborem (orphan)', () => {
    const col = findCollisions(
      [{ from: 'phase-2.md', to: 'phase-001.md' }],
      ['phase-2.md', 'phase-001.md'], // phase-001.md existuje a nepřejmenovává se
    );
    expect(col).toContain('phase-001.md');
  });

  it('cíl obsazený souborem, který se ale sám přejmenovává pryč → není kolize', () => {
    const col = findCollisions(
      [
        { from: 'phase-029.json', to: 'phase-030.json' },
        { from: 'phase-030.json', to: 'phase-031.json' },
      ],
      ['phase-029.json', 'phase-030.json'],
    );
    expect(col).toEqual([]);
  });
});
