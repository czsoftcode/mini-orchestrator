import { describe, expect, it } from 'vitest';
import {
  findVersion,
  latestReleased,
  parseChangelogSections,
  stampUnreleased,
  todayIso,
  unreleasedSection,
} from './changelog.js';

const withUnreleased = (body: string) =>
  `# Changelog

## [Unreleased]
${body}
## [0.9.0] - 2026-01-01
### Added
- starší věc
`;

describe('stampUnreleased', () => {
  it('zaklapne neprázdnou Unreleased do datované sekce a vloží novou prázdnou', () => {
    const input = withUnreleased(`### Added
- nová funkce
`);
    const r = stampUnreleased(input, '1.0.0', '2026-05-30');

    expect(r.stamped).toBe(true);
    expect(r.content).toContain('## [1.0.0] - 2026-05-30');
    // Položky zůstaly pod datovanou sekcí.
    expect(r.content).toMatch(/## \[1\.0\.0\] - 2026-05-30\n### Added\n- nová funkce/);
    // Nahoře je nová prázdná Unreleased.
    expect(r.content).toMatch(/## \[Unreleased\]\n\n## \[1\.0\.0\]/);
    // Starší sekce zůstala beze změny.
    expect(r.content).toContain('## [0.9.0] - 2026-01-01');
  });

  it('prázdnou Unreleased nestampuje (idempotence)', () => {
    const input = withUnreleased('\n');
    const r = stampUnreleased(input, '1.0.0', '2026-05-30');

    expect(r.stamped).toBe(false);
    expect(r.reason).toBe('empty-unreleased');
    expect(r.content).toBe(input);
  });

  it('opakované stampování čerstvě vložené prázdné Unreleased nic neudělá', () => {
    const first = stampUnreleased(withUnreleased('### Fixed\n- oprava\n'), '1.0.0', '2026-05-30');
    expect(first.stamped).toBe(true);

    const second = stampUnreleased(first.content, '1.0.1', '2026-06-01');
    expect(second.stamped).toBe(false);
    expect(second.reason).toBe('empty-unreleased');
    expect(second.content).toBe(first.content);
  });

  it('chybějící nadpis Unreleased vrátí no-unreleased beze změny', () => {
    const input = '# Changelog\n\n## [0.9.0] - 2026-01-01\n### Added\n- věc\n';
    const r = stampUnreleased(input, '1.0.0', '2026-05-30');

    expect(r.stamped).toBe(false);
    expect(r.reason).toBe('no-unreleased');
    expect(r.content).toBe(input);
  });

  it('Unreleased je tolerantní k velikosti písmen a mezerám', () => {
    const input = '#  changelog\n\n##   [unreleased]\n### Added\n- věc\n';
    const r = stampUnreleased(input, '2.0.0', '2026-05-30');
    expect(r.stamped).toBe(true);
    expect(r.content).toContain('## [2.0.0] - 2026-05-30');
  });

  it('Unreleased jako poslední sekce (bez následujícího nadpisu)', () => {
    const input = '# Changelog\n\n## [Unreleased]\n### Added\n- věc\n';
    const r = stampUnreleased(input, '1.0.0', '2026-05-30');
    expect(r.stamped).toBe(true);
    expect(r.content).toContain('## [1.0.0] - 2026-05-30');
    expect(r.content).toMatch(/## \[Unreleased\]\n\n## \[1\.0\.0\]/);
  });
});

describe('todayIso', () => {
  it('formátuje datum jako YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 4, 30))).toBe('2026-05-30');
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

const SAMPLE = `# Changelog

Intro paragraph that is not a section.

## [Unreleased]

### Added

- pending thing

## [1.2.0] - 2026-02-01

### Added

- a feature

## [1.1.0] - 2026-01-01

### Fixed

- a bug
`;

describe('parseChangelogSections', () => {
  it('splits into sections in file order, ignoring the intro', () => {
    const s = parseChangelogSections(SAMPLE);
    expect(s.map((x) => x.heading)).toEqual([
      '[Unreleased]',
      '[1.2.0] - 2026-02-01',
      '[1.1.0] - 2026-01-01',
    ]);
  });

  it('marks Unreleased (version null, not released) and dated versions', () => {
    const s = parseChangelogSections(SAMPLE);
    expect(s[0]).toMatchObject({ version: null, released: false });
    expect(s[1]).toMatchObject({ version: '1.2.0', released: true });
    expect(s[1]!.body).toContain('- a feature');
  });

  it('returns an empty list when there are no sections', () => {
    expect(parseChangelogSections('# Changelog\n\njust intro\n')).toEqual([]);
  });
});

describe('latestReleased / unreleasedSection', () => {
  it('picks the newest dated section', () => {
    expect(latestReleased(parseChangelogSections(SAMPLE))?.version).toBe('1.2.0');
  });

  it('returns the Unreleased section body', () => {
    expect(unreleasedSection(parseChangelogSections(SAMPLE))?.body).toContain('- pending thing');
  });

  it('latestReleased is null with no dated sections', () => {
    const onlyUnreleased = '# Changelog\n\n## [Unreleased]\n\n- x\n';
    expect(latestReleased(parseChangelogSections(onlyUnreleased))).toBeNull();
  });
});

describe('findVersion', () => {
  const sections = parseChangelogSections(SAMPLE);

  it('matches an exact version', () => {
    expect(findVersion(sections, '1.1.0')?.heading).toBe('[1.1.0] - 2026-01-01');
  });

  it('tolerates a leading v', () => {
    expect(findVersion(sections, 'v1.2.0')?.version).toBe('1.2.0');
  });

  it('matches unreleased by word', () => {
    expect(findVersion(sections, 'unreleased')?.version).toBeNull();
  });

  it('returns null for an unknown version', () => {
    expect(findVersion(sections, '9.9.9')).toBeNull();
  });
});
