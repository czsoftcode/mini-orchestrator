import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { phaseStem } from './store.js';

/**
 * Durable store for **adversarial review findings**, decoupled from the phase's
 * run report.
 *
 * The red-team step (`mini adversarial` / `/mini:adversarial`) used to write its
 * findings with `Edit` straight into the run report of the phase under review
 * (`.mini/run/phase-{id}.md`). Once that phase closed, nobody opened the report
 * again — the finding was buried and could not feed later work. This store fixes
 * that: findings live in their own `.mini/findings/` directory, are versioned
 * with the code (durable across sessions, like `.mini/decisions/` and
 * `.mini/memory/`), and carry an explicit `open`/`resolved` status so later
 * phases can pick up what is still open.
 *
 * Layout, following the `decisionStore`/`todoStore` precedents:
 * - **one file per origin phase** — `.mini/findings/phase-{id}.md`, bound to the
 *   phase id via the shared `phaseStem` (no independent numbering),
 * - but unlike a decision (one per phase), a file holds **multiple** entries — a
 *   red-team yields several findings. Each entry needs a machine-readable
 *   **status** for a later `resolve`/consume step, so this is the one store with
 *   a real parse contract (not just a writer's convention).
 *
 * Entry format (the contract a later `resolve` relies on — id + severity +
 * single status token live on one rewritable header line):
 *
 * ```
 * ## 155-1 · should-know · open
 * **Where:** src/foo.ts:42
 * **Reviewed-at:** 1a2b3c4d…
 * Short title of the finding.
 *
 * Optional longer body (what breaks and how).
 * ```
 *
 * The `**Reviewed-at:**` line is optional (older files predate it; reviews
 * outside a git repo omit it) — the parser treats its absence as `undefined`.
 *
 * This phase only **writes** (`addFinding`) and **lists** (`listFindings`).
 * Flipping a status (`resolve`), a `doctor` orphan-check and consumption in
 * `next`/`plan`/`do` are deliberate follow-up phases.
 */
export const FINDINGS_DIR = join('.mini', 'findings');

export type FindingSeverity = 'blocker' | 'should-know' | 'nit';
export type FindingStatus = 'open' | 'resolved';

/** The three severities a finding may carry — the same vocabulary the prompt uses. */
export const FINDING_SEVERITIES: readonly FindingSeverity[] = ['blocker', 'should-know', 'nit'];

/** A single recorded finding. */
export interface Finding {
  /** Stable unique id, `{phaseId}-{n}` (e.g. `155-1`). The `{n}` is sequential within the phase file. */
  id: string;
  /** Origin phase — the phase the finding is about (derived from the id prefix). */
  phaseId: number;
  severity: FindingSeverity;
  status: FindingStatus;
  /** Optional location (`file:line`). */
  where?: string;
  /**
   * Optional baseline commit the review was performed against — the full HEAD SHA
   * at review time. Because a review runs between `do` and `done` (the phase work
   * is still uncommitted), this is the phase's **parent** commit, **not** the
   * commit of the reviewed code. A later consumer treats it as "the code state the
   * review started from", not "the reviewed commit". Absent outside a git repo.
   */
  reviewedAt?: string;
  /** Short headline of the finding (required). */
  title: string;
  /** Optional longer body — what breaks and how. */
  body?: string;
}

/** Input to {@link addFinding} — everything except the id/status, which mini owns. */
export interface NewFinding {
  severity: FindingSeverity;
  title: string;
  where?: string;
  /** Baseline commit SHA at review time (see {@link Finding.reviewedAt}); omitted outside git. */
  reviewedAt?: string;
  body?: string;
}

const HEADER = [
  '# Adversarial findings',
  '',
  '> Recorded by `mini findings add` (the adversarial review step). Each entry is',
  '> `## <id> · <severity> · <status>`; do not hand-edit those header lines.',
  '',
  '',
].join('\n');

/** Matches an entry header line `## <id> · <severity> · <status>`. */
const ENTRY_RE = /^##\s+(\S+)\s+·\s+(blocker|should-know|nit)\s+·\s+(open|resolved)\s*$/;
/** Matches the optional `**Where:** …` line directly under the header. */
const WHERE_RE = /^\*\*Where:\*\*\s+(.*)$/;
/** Matches the optional `**Reviewed-at:** …` metadata line (after `**Where:**`). */
const REVIEWED_AT_RE = /^\*\*Reviewed-at:\*\*\s+(.*)$/;
/** Is the severity one of the three accepted values? */
export function isFindingSeverity(value: string): value is FindingSeverity {
  return (FINDING_SEVERITIES as readonly string[]).includes(value);
}

/** Path to a phase's findings file (`.mini/findings/phase-{id}.md`). */
export function findingsPath(cwd: string, phaseId: number): string {
  return join(cwd, FINDINGS_DIR, `${phaseStem(phaseId)}.md`);
}

/** The numeric origin phase from a finding id (`155-1` → `155`, `1.5-2` → `1.5`); `null` if malformed. */
function phaseIdFromFindingId(id: string): number | null {
  const m = /^(\d+(?:\.\d+)?)-\d+$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** The sequential `{n}` suffix of a finding id (`155-3` → `3`); `0` when absent. */
function suffixOf(id: string): number {
  const m = /-(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/**
 * Parses the markdown into typed findings. Each entry runs from its `##` header
 * to the next header (or EOF). Within an entry: an optional `**Where:**` line, a
 * required title (the first non-empty line after it) and an optional body (the
 * rest). Entries with a malformed id (no `{phaseId}-{n}` shape) or no title are
 * dropped — a hand-broken header silently loses that one entry, matching how
 * `decisionStore`/`todoStore` ignore lines they cannot parse. Non-entry lines
 * (the header comment) are ignored, so the file survives a parse → serialize
 * round-trip.
 */
export function parseFindings(md: string): Finding[] {
  const lines = md.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  const out: Finding[] = [];

  let header: { id: string; severity: FindingSeverity; status: FindingStatus } | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (!header) return;
    const phaseId = phaseIdFromFindingId(header.id);
    if (phaseId !== null) {
      const parsed = parseEntryBody(buffer);
      if (parsed.title) {
        const finding: Finding = {
          id: header.id,
          phaseId,
          severity: header.severity,
          status: header.status,
          title: parsed.title,
        };
        if (parsed.where) finding.where = parsed.where;
        if (parsed.reviewedAt) finding.reviewedAt = parsed.reviewedAt;
        if (parsed.body) finding.body = parsed.body;
        out.push(finding);
      }
    }
    header = null;
    buffer = [];
  };

  for (const line of lines) {
    const h = ENTRY_RE.exec(line);
    if (h) {
      flush();
      header = {
        id: h[1] as string,
        severity: h[2] as FindingSeverity,
        status: h[3] as FindingStatus,
      };
      continue;
    }
    if (header) buffer.push(line);
  }
  flush();
  return out;
}

/**
 * Splits an entry's body lines into optional `where` / `reviewedAt` metadata, a
 * required title and an optional body. The metadata lines (when present) sit
 * directly under the header in `**Where:**`, `**Reviewed-at:**` order; either may
 * be absent, so the parser round-trips both old files (no `**Reviewed-at:**`) and
 * findings recorded outside a git repo.
 */
function parseEntryBody(lines: string[]): {
  where?: string;
  reviewedAt?: string;
  title?: string;
  body?: string;
} {
  let i = 0;
  const skipBlank = (): void => {
    while (i < lines.length && (lines[i] as string).trim() === '') i++;
  };
  // Skip leading blank lines between the header and the first content.
  skipBlank();

  let where: string | undefined;
  const w = i < lines.length ? WHERE_RE.exec((lines[i] as string).trim()) : null;
  if (w) {
    where = (w[1] as string).trim();
    i++;
    skipBlank();
  }

  let reviewedAt: string | undefined;
  const r = i < lines.length ? REVIEWED_AT_RE.exec((lines[i] as string).trim()) : null;
  if (r) {
    reviewedAt = (r[1] as string).trim();
    i++;
    skipBlank();
  }

  const meta: { where?: string; reviewedAt?: string } = {};
  if (where) meta.where = where;
  if (reviewedAt) meta.reviewedAt = reviewedAt;

  if (i >= lines.length) return meta;
  const title = (lines[i] as string).trim();
  i++;

  const body = lines.slice(i).join('\n').trim();
  const result: { where?: string; reviewedAt?: string; title?: string; body?: string } = {
    ...meta,
    title,
  };
  if (body) result.body = body;
  return result;
}

/** Renders findings back into a phase file (header comment + entries). */
export function serializeFindings(findings: Finding[]): string {
  const blocks = findings.map((f) => {
    const out = [`## ${f.id} · ${f.severity} · ${f.status}`];
    if (f.where?.trim()) out.push(`**Where:** ${f.where.trim()}`);
    if (f.reviewedAt?.trim()) out.push(`**Reviewed-at:** ${f.reviewedAt.trim()}`);
    out.push(f.title.trim());
    if (f.body?.trim()) out.push('', f.body.trim());
    return out.join('\n');
  });
  const body = blocks.length > 0 ? blocks.join('\n\n') : '_(no findings)_';
  return `${HEADER}${body}\n`;
}

/** Reads and parses one phase's findings file; a missing file yields an empty list. */
export async function readPhaseFindings(cwd: string, phaseId: number): Promise<Finding[]> {
  try {
    return parseFindings(await readFile(findingsPath(cwd, phaseId), 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Looks up a single finding by its id (`{originPhaseId}-{n}`). Derives the origin
 * phase from the id prefix and reads only that phase's file — a targeted read, not
 * a full directory scan. Includes resolved findings (the caller decides whether the
 * status matters). Returns `null` for a malformed id, a missing file or an id that
 * is not present — never throws.
 */
export async function findFindingById(cwd: string, id: string): Promise<Finding | null> {
  const phaseId = phaseIdFromFindingId(id);
  if (phaseId === null) return null;
  const findings = await readPhaseFindings(cwd, phaseId);
  return findings.find((f) => f.id === id) ?? null;
}

/**
 * Flips one finding's status in place. Derives the origin phase from the id,
 * reads only that phase's file (a targeted read, like {@link findFindingById}),
 * rewrites the single matching entry and re-serializes the file. Returns `true`
 * when the file was actually rewritten, `false` on a no-op.
 *
 * Deliberately tolerant — it never throws on the unhappy paths a `done`/`undo`
 * caller must survive: a malformed id, a missing file, an id not present, or a
 * status that already matches the target all return `false` and leave disk
 * untouched. Only the one entry's status token changes; the rest of the file
 * (other entries, the header comment, `**Reviewed-at:**`/body) round-trips
 * through {@link parseFindings} → {@link serializeFindings}.
 */
async function setFindingStatus(
  cwd: string,
  id: string,
  status: FindingStatus,
): Promise<boolean> {
  const phaseId = phaseIdFromFindingId(id);
  if (phaseId === null) return false;
  const findings = await readPhaseFindings(cwd, phaseId);
  const target = findings.find((f) => f.id === id);
  if (!target || target.status === status) return false;
  target.status = status;
  try {
    await writeFile(findingsPath(cwd, phaseId), serializeFindings(findings), 'utf8');
  } catch {
    return false;
  }
  return true;
}

/**
 * Marks a finding as `resolved` (e.g. when the fix phase linked to it closes).
 * No-op when the finding is missing, malformed or already resolved. Returns
 * whether the file changed. See {@link setFindingStatus}.
 */
export function resolveFinding(cwd: string, id: string): Promise<boolean> {
  return setFindingStatus(cwd, id, 'resolved');
}

/**
 * Reopens a finding back to `open` (e.g. when `mini undo` reverts the phase that
 * resolved it). No-op when the finding is missing, malformed or already open.
 * Returns whether the file changed. See {@link setFindingStatus}.
 */
export function reopenFinding(cwd: string, id: string): Promise<boolean> {
  return setFindingStatus(cwd, id, 'open');
}

/**
 * Appends a finding to a phase's file and returns its assigned id and the path.
 *
 * The id is sequential **within the phase file**: `addFinding` reads the existing
 * entries, takes the highest `{n}` suffix and uses the next one (`{phaseId}-{n}`).
 * Calls are sequential single-process CLI invocations, so the read-modify-write
 * carries no concurrency risk. The directory is created on demand.
 */
export async function addFinding(
  cwd: string,
  phaseId: number,
  input: NewFinding,
): Promise<{ id: string; path: string }> {
  const existing = await readPhaseFindings(cwd, phaseId);
  const nextIndex = existing.reduce((max, f) => Math.max(max, suffixOf(f.id)), 0) + 1;
  const id = `${phaseId}-${nextIndex}`;

  const finding: Finding = {
    id,
    phaseId,
    severity: input.severity,
    status: 'open',
    // Title is a single line by contract — collapse any newlines so it can never
    // smuggle a second `## id · severity · status` header line into the file.
    title: input.title.replace(/\s*\n\s*/g, ' ').trim(),
  };
  if (input.where?.trim()) finding.where = input.where.trim();
  if (input.reviewedAt?.trim()) finding.reviewedAt = input.reviewedAt.trim();
  if (input.body?.trim()) finding.body = input.body.trim();

  const path = findingsPath(cwd, phaseId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeFindings([...existing, finding]), 'utf8');
  return { id, path };
}

/**
 * Lists findings across **all** phases — a single `readdir` of `.mini/findings/`,
 * parsing every `phase-{id}.md`. Open findings only by default (the cross-phase
 * backlog the store exists for); `includeResolved` adds the resolved ones too.
 * A missing directory (nothing ever recorded) yields an empty list, never an
 * error. Sorted by origin phase, then by the entry's sequential index.
 */
export async function listFindings(
  cwd: string,
  opts: { includeResolved?: boolean } = {},
): Promise<Finding[]> {
  let names: string[];
  try {
    names = await readdir(join(cwd, FINDINGS_DIR));
  } catch {
    return [];
  }
  const all: Finding[] = [];
  for (const name of names) {
    if (!/^phase-\d+(?:\.\d+)?\.md$/.test(name)) continue;
    try {
      all.push(...parseFindings(await readFile(join(cwd, FINDINGS_DIR, name), 'utf8')));
    } catch {
      // Unreadable file — skip it rather than failing the whole listing.
    }
  }
  const filtered = opts.includeResolved ? all : all.filter((f) => f.status === 'open');
  filtered.sort((a, b) => a.phaseId - b.phaseId || suffixOf(a.id) - suffixOf(b.id));
  return filtered;
}
