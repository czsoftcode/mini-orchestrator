import { describe, expect, it } from 'vitest';
import { stampUnreleased, todayIso } from './changelog.js';

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
