import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { bumpSemver } from './version.js';
import type { BumpLevel, BumpResult } from './version.js';

/**
 * Where the project's version lives. Each language has its own convention, so
 * `done` writes the version to the place that fits the project, not always to
 * `package.json`. `VERSION` is the language-agnostic fallback.
 */
export type VersionSource =
  | 'package.json'
  | 'Cargo.toml'
  | 'pyproject.toml'
  | 'setup.py'
  | 'composer.json'
  | '__version__'
  | 'VERSION';

export interface ProjectBumpResult extends BumpResult {
  /** Which file the version was read from / written to. */
  source: VersionSource;
  /** `true` when the `VERSION` fallback file was created fresh by this bump. */
  created?: boolean;
}

/** Starting version written into a freshly created `VERSION` fallback file. */
export const FALLBACK_INITIAL_VERSION = '0.1.0';

/**
 * Bumps the project version **in the place that matches the project's
 * language** and writes it back. Sources are tried in a fixed priority and the
 * **first one that carries a usable version** wins — only that file is touched:
 *
 * 1. `package.json`   (JS/TS)
 * 2. `Cargo.toml`     (Rust, `[package]` section)
 * 3. `pyproject.toml` (Python, `[project]` or `[tool.poetry]`)
 * 4. `setup.py`       (Python, `version="x.y.z"`)
 * 5. `composer.json`  (PHP — only when a `version` field is already present)
 * 6. `__version__`    (Python, `__version__ = "x.y.z"` in a common location)
 * 7. `VERSION`        (language-agnostic fallback — a single `x.y.z` line)
 *
 * When none of 1–6 matches, the `VERSION` fallback is used; if it does not
 * exist yet, it is **created** with {@link FALLBACK_INITIAL_VERSION} (the bump
 * level is ignored on creation — that version is the starting point).
 *
 * The write is always a **textual replacement of the version value only** — no
 * JSON/TOML reformatting — so the diff stays a single line.
 *
 * Returns the source and `from`/`to`, or `null` only when a source was found
 * but its version could not be parsed and the fallback could not be written.
 */
export async function bumpProjectVersion(
  cwd: string,
  level: BumpLevel = 'patch',
): Promise<ProjectBumpResult | null> {
  return (
    (await bumpJsonVersion(cwd, 'package.json', level)) ??
    (await bumpTomlVersion(cwd, 'Cargo.toml', ['package'], level)) ??
    (await bumpTomlVersion(cwd, 'pyproject.toml', ['project', 'tool.poetry'], level)) ??
    (await bumpSetupPy(cwd, level)) ??
    (await bumpJsonVersion(cwd, 'composer.json', level)) ??
    (await bumpDunderVersion(cwd, level)) ??
    (await bumpVersionFile(cwd, level))
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Bumps `"version": "x.y.z"` in a JSON manifest (`package.json`,
 * `composer.json`). Returns `null` when the file is missing or has no `version`
 * field — `composer.json` deliberately often omits it (versions come from git
 * tags), so we never add the field, we fall through to the next source.
 */
async function bumpJsonVersion(
  cwd: string,
  file: 'package.json' | 'composer.json',
  level: BumpLevel,
): Promise<ProjectBumpResult | null> {
  const raw = await tryRead(join(cwd, file));
  if (raw === null) return null;

  const re = /("version"\s*:\s*")([^"]+)(")/;
  const m = raw.match(re);
  if (!m) return null;
  const from = m[2]!;
  const to = bumpSemver(from, level);
  if (!to) return null;

  await writeFile(join(cwd, file), raw.replace(re, `$1${to}$3`), 'utf-8');
  return { from, to, source: file };
}

/**
 * Bumps `version = "x.y.z"` inside the **first matching TOML section** of the
 * given names (e.g. `[package]` for Cargo, `[project]`/`[tool.poetry]` for
 * pyproject). Scoping to the section matters: `Cargo.toml` carries `version`
 * lines under `[dependencies]` too, which must not be touched.
 *
 * A section without a literal `version` line (e.g. pyproject with `dynamic =
 * ["version"]`, or a workspace root without `[package]`) yields `null`, so we
 * fall through to the next source.
 */
async function bumpTomlVersion(
  cwd: string,
  file: string,
  sections: string[],
  level: BumpLevel,
): Promise<ProjectBumpResult | null> {
  const raw = await tryRead(join(cwd, file));
  if (raw === null) return null;

  for (const section of sections) {
    const headerRe = new RegExp(`(^|\\n)\\[${escapeRegExp(section)}\\][^\\n]*\\n`);
    const hm = headerRe.exec(raw);
    if (!hm) continue;

    const bodyStart = hm.index + hm[0].length;
    const rest = raw.slice(bodyStart);
    const nextHeaderRel = rest.search(/\n[ \t]*\[[^\]]+\]/);
    const bodyEnd = nextHeaderRel === -1 ? raw.length : bodyStart + nextHeaderRel;
    const body = raw.slice(bodyStart, bodyEnd);

    const verRe = /(^|\n)([ \t]*version[ \t]*=[ \t]*["'])([^"']+)(["'])/;
    const vm = body.match(verRe);
    if (!vm) continue;
    const from = vm[3]!;
    const to = bumpSemver(from, level);
    if (!to) continue;

    const newBody = body.replace(verRe, `$1$2${to}$4`);
    const next = raw.slice(0, bodyStart) + newBody + raw.slice(bodyEnd);
    await writeFile(join(cwd, file), next, 'utf-8');
    return { from, to, source: file as VersionSource };
  }
  return null;
}

/** Bumps `version="x.y.z"` (single or double quotes) in `setup.py`. */
async function bumpSetupPy(cwd: string, level: BumpLevel): Promise<ProjectBumpResult | null> {
  const raw = await tryRead(join(cwd, 'setup.py'));
  if (raw === null) return null;

  const re = /(version[ \t]*=[ \t]*["'])([^"']+)(["'])/;
  const m = raw.match(re);
  if (!m) return null;
  const from = m[2]!;
  const to = bumpSemver(from, level);
  if (!to) return null;

  await writeFile(join(cwd, 'setup.py'), raw.replace(re, `$1${to}$3`), 'utf-8');
  return { from, to, source: 'setup.py' };
}

/**
 * Last-resort Python source: `__version__ = "x.y.z"`. Searched in common
 * locations — root `*.py` files and `__init__.py` / `_version.py` /
 * `version.py` one directory deep. Best-effort: the first file with a parseable
 * `__version__` wins; nothing found → `null` (fall through to `VERSION`).
 */
async function bumpDunderVersion(cwd: string, level: BumpLevel): Promise<ProjectBumpResult | null> {
  const re = /(__version__[ \t]*=[ \t]*["'])([^"']+)(["'])/;
  for (const file of await collectDunderCandidates(cwd)) {
    const raw = await tryRead(file);
    if (raw === null) continue;
    const m = raw.match(re);
    if (!m) continue;
    const from = m[2]!;
    const to = bumpSemver(from, level);
    if (!to) continue;
    await writeFile(file, raw.replace(re, `$1${to}$3`), 'utf-8');
    return { from, to, source: '__version__' };
  }
  return null;
}

async function collectDunderCandidates(cwd: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(cwd, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.py')) out.push(join(cwd, e.name));
  }
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      for (const f of ['__init__.py', '_version.py', 'version.py']) {
        out.push(join(cwd, e.name, f));
      }
    }
  }
  return out;
}

/**
 * Language-agnostic fallback `VERSION` file — a single `x.y.z` line. When it
 * exists, its version is bumped; when it does not, it is created with
 * {@link FALLBACK_INITIAL_VERSION} (the bump level is ignored — that is the
 * starting point). This is the source for projects whose language has no
 * recognized manifest.
 */
async function bumpVersionFile(cwd: string, level: BumpLevel): Promise<ProjectBumpResult | null> {
  const path = join(cwd, 'VERSION');
  const raw = await tryRead(path);

  if (raw === null) {
    await writeFile(path, `${FALLBACK_INITIAL_VERSION}\n`, 'utf-8');
    return { from: '0.0.0', to: FALLBACK_INITIAL_VERSION, source: 'VERSION', created: true };
  }

  const from = raw.trim();
  const to = bumpSemver(from, level);
  if (!to) {
    // The file exists but is not a valid semver — overwrite with the initial
    // version rather than leaving the project unversioned.
    await writeFile(path, `${FALLBACK_INITIAL_VERSION}\n`, 'utf-8');
    return { from: '0.0.0', to: FALLBACK_INITIAL_VERSION, source: 'VERSION', created: true };
  }

  // Preserve a trailing newline if the original had one.
  const next = raw.endsWith('\n') ? `${to}\n` : to;
  await writeFile(path, next, 'utf-8');
  return { from, to, source: 'VERSION' };
}

async function tryRead(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}
