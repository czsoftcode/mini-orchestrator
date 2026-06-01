/**
 * Práce s `CHANGELOG.md` ve formátu keepachangelog 1.1.0.
 *
 * Claude během `/mini:done` doplňuje položky pod `## [Unreleased]`. Při vydání
 * (`mini done --apply --push` s `--bump minor`/`major`) se obsah Unreleased
 * „zaklapne" do datované sekce `## [<verze>] - <YYYY-MM-DD>` a nad ni se vloží
 * nová prázdná `## [Unreleased]`. Patche se nestampují — kumulují se v Unreleased
 * až do dalšího minor/major vydání.
 */

/** Název souboru s changelogem v kořeni projektu. */
export const CHANGELOG_FILE = 'CHANGELOG.md';

/** Řádek nadpisu `## [Unreleased]` (case-insensitive, tolerantní k mezerám). */
const UNRELEASED_HEADING = /^##\s+\[Unreleased\]\s*$/i;

/** Jakýkoli nadpis 2. úrovně — hranice sekce Unreleased. */
const SECTION_HEADING = /^##\s+/;

export interface StampResult {
  /** Nový obsah changelogu (při `stamped: false` shodný se vstupem). */
  content: string;
  /** Vznikla datovaná sekce z Unreleased? */
  stamped: boolean;
  /**
   * Proč se nestampovalo (jen když `stamped: false`):
   * - `no-unreleased` — v souboru chybí nadpis `## [Unreleased]`,
   * - `empty-unreleased` — sekce Unreleased nemá žádné položky.
   */
  reason?: 'no-unreleased' | 'empty-unreleased';
}

/**
 * Dnešní datum v ISO tvaru `YYYY-MM-DD` (lokální čas).
 */
export function todayIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Zaklapne obsah `## [Unreleased]` do datované sekce `## [<verze>] - <datum>`
 * a nad ni vloží novou prázdnou `## [Unreleased]`. Tělo Unreleased zůstává na
 * místě — jen se přejmenuje nadpis a nad něj přibude prázdná Unreleased.
 *
 * Nestampuje (vrací `stamped: false` a beze změny vstup), když:
 * - chybí nadpis `## [Unreleased]` (`reason: 'no-unreleased'`),
 * - sekce Unreleased je prázdná (`reason: 'empty-unreleased'`) — idempotence:
 *   opakované volání nad čerstvě vloženou prázdnou Unreleased nic neudělá.
 */
export function stampUnreleased(content: string, version: string, date: string): StampResult {
  const lines = content.split('\n');

  const start = lines.findIndex((line) => UNRELEASED_HEADING.test(line));
  if (start === -1) {
    return { content, stamped: false, reason: 'no-unreleased' };
  }

  // Konec sekce = další nadpis 2. úrovně (nebo konec souboru).
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTION_HEADING.test(lines[i]!)) {
      end = i;
      break;
    }
  }

  const body = lines.slice(start + 1, end).join('\n');
  if (body.trim() === '') {
    return { content, stamped: false, reason: 'empty-unreleased' };
  }

  const released = lines[start]!.replace(UNRELEASED_HEADING, `## [${version}] - ${date}`);
  lines.splice(start, 1, '## [Unreleased]', '', released);

  return { content: lines.join('\n'), stamped: true };
}

/** A single `## [...]` section of the changelog. */
export interface ChangelogSection {
  /** The heading text without the leading `## `, e.g. `[1.10.4] - 2026-06-01`. */
  heading: string;
  /** The version inside the brackets (`1.10.4`), or `null` for `[Unreleased]`. */
  version: string | null;
  /** A released, dated section (`[x.y.z] - date`) as opposed to `[Unreleased]`. */
  released: boolean;
  /** The body under the heading, trimmed (no surrounding blank lines). */
  body: string;
}

/** Captures the bracket label and an optional ` - date` suffix from a `## ` heading. */
const VERSION_HEADING = /^##\s+\[([^\]]+)\]\s*(?:-\s*(.+))?$/;

/**
 * Splits the changelog into its `## [...]` sections (newest first, in file order).
 * Anything before the first level-2 heading (the title/intro) is ignored. The
 * `[Unreleased]` section has `version: null` and `released: false`.
 */
export function parseChangelogSections(content: string): ChangelogSection[] {
  const lines = content.split('\n');
  const sections: ChangelogSection[] = [];
  let current: { heading: string; version: string | null; released: boolean; body: string[] } | null =
    null;

  const flush = (): void => {
    if (current) {
      sections.push({
        heading: current.heading,
        version: current.version,
        released: current.released,
        body: current.body.join('\n').trim(),
      });
    }
  };

  for (const line of lines) {
    const m = VERSION_HEADING.exec(line);
    if (m) {
      flush();
      const label = m[1]!.trim();
      const isUnreleased = /^unreleased$/i.test(label);
      current = {
        heading: line.replace(/^##\s+/, '').trim(),
        version: isUnreleased ? null : label,
        released: !isUnreleased && Boolean(m[2]?.trim()),
        body: [],
      };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return sections;
}

/** The most recent released (dated) section, or `null` when there is none. */
export function latestReleased(sections: ChangelogSection[]): ChangelogSection | null {
  return sections.find((s) => s.released) ?? null;
}

/** The `[Unreleased]` section, or `null` when absent. */
export function unreleasedSection(sections: ChangelogSection[]): ChangelogSection | null {
  return sections.find((s) => s.version === null) ?? null;
}

/**
 * The section for a specific version, or `null` when not found. Tolerant of a
 * leading `v` (`v1.2.0` matches `1.2.0`); the `[Unreleased]` section is matched
 * by the word `unreleased` (any case).
 */
export function findVersion(sections: ChangelogSection[], query: string): ChangelogSection | null {
  const want = query.trim().replace(/^v/i, '').toLowerCase();
  if (want === 'unreleased') return unreleasedSection(sections);
  return sections.find((s) => s.version?.toLowerCase() === want) ?? null;
}
