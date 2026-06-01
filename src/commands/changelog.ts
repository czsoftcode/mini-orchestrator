import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CHANGELOG_FILE,
  type ChangelogSection,
  findVersion,
  latestReleased,
  parseChangelogSections,
  unreleasedSection,
} from '../changelog.js';
import { log } from '../ui/log.js';

export interface ChangelogOptions {
  /** Print the whole `CHANGELOG.md` instead of a single section. */
  all?: boolean;
  /** Print the pending `[Unreleased]` section instead of the latest release. */
  unreleased?: boolean;
  /** Print the section for a specific version (tolerant of a leading `v`). */
  version?: string;
}

/**
 * `mini changelog` — shows the project's `CHANGELOG.md` changes.
 *
 * - bare: the latest released (dated) version's section,
 * - `--unreleased`: the pending `[Unreleased]` section,
 * - `--all`: the whole changelog verbatim.
 *
 * Independent of the `.mini/` state — it just reads `CHANGELOG.md` from the cwd.
 */
export async function changelog(opts: ChangelogOptions = {}): Promise<void> {
  const path = join(process.cwd(), CHANGELOG_FILE);

  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch {
    log.warn(`No ${CHANGELOG_FILE} in this directory.`);
    return;
  }

  if (opts.all) {
    console.log(content.replace(/\n+$/, ''));
    return;
  }

  const sections = parseChangelogSections(content);
  if (sections.length === 0) {
    log.warn(`${CHANGELOG_FILE} has no version sections.`);
    return;
  }

  if (opts.version) {
    const match = findVersion(sections, opts.version);
    if (!match) {
      log.warn(`No section for version "${opts.version}".`);
      const available = sections.map((s) => s.version ?? 'Unreleased').join(', ');
      log.hint(`Available: ${available}`);
      return;
    }
    printSection(match);
    return;
  }

  if (opts.unreleased) {
    const u = unreleasedSection(sections);
    if (!u || u.body === '') {
      log.info('No unreleased changes.');
      return;
    }
    printSection(u);
    return;
  }

  const latest = latestReleased(sections);
  if (!latest) {
    const u = unreleasedSection(sections);
    if (u && u.body) {
      printSection(u);
      log.hint('No released version yet — showing the Unreleased section.');
    } else {
      log.info('No released version yet.');
    }
    return;
  }

  printSection(latest);
  const u = unreleasedSection(sections);
  if (u && u.body) {
    log.hint('There are unreleased changes too — see `mini changelog --unreleased` (or `--all`).');
  }
}

function printSection(s: ChangelogSection): void {
  log.title(s.heading);
  console.log();
  console.log(s.body);
}
