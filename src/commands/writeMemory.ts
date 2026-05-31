import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { askClaude } from '../claude/ask.js';
import {
  buildWriteMemoryPrompt,
  LAST_MEMORY_FILE,
  MEMORY_DIR,
} from '../prompts/writeMemory.js';
import { phaseStem, readProject } from '../state/store.js';
import type { Phase, ProjectState, StepStatus } from '../state/types.js';
import { log } from '../ui/log.js';
import { logUsage } from '../ui/usage.js';

// Live constants of the explicit memory mode — used by `writeViaClaude` when the
// `memory` scope is set manually via `mini model`. They are NOT dead code: the
// step from phase 17 "remove MEMORY_ALLOWED_TOOLS / MEMORY_TIMEOUT_MS / the
// buildWriteMemoryPrompt import" was therefore deliberately skipped. Don't delete them.
const MEMORY_ALLOWED_TOOLS = ['Read', 'Bash', 'Write'];
const MEMORY_TIMEOUT_MS = 5 * 60 * 1000;

const DISCUSS_DIR_REL = join('.mini', 'discuss');
const RUN_DIR_REL = join('.mini', 'run');

const STEP_WORD: Record<StepStatus, string> = {
  done: 'done',
  doing: 'doing',
  todo: 'todo',
  skipped: 'skipped',
};

// Names of the "big" sections of the memory collage. Shared between the producer
// (`buildPhaseMemoryMarkdown`) and the consumer (`summarizeMemoryForNext`) so the
// anchors never diverge — whoever renames a section changes both in one place.
const DISCUSS_SECTION = 'Discussion';
const RUN_REPORT_SECTION = 'Run report';

// Legacy anchor of the discuss section. The producer now writes the English
// `Discussion`, but existing memory files (.mini/memory/*.md) still have the Czech
// `Diskuse` — the consumer keeps reading both. RUN_REPORT_SECTION was English from
// the start, so it needs no alias.
const DISCUSS_SECTION_LEGACY = 'Diskuse';

/**
 * Writes the memory file for a finished phase into `.mini/memory/phase-XXX.md`
 * and saves its short summary into `.mini/last-memory.md` (input of the `next` prompt).
 *
 * The name carries only the padded phase ID (`phaseStem`) — no date. When a file
 * for the same phase already exists (a repeated `done`), a numeric discriminator
 * is appended (`phase-XXX-2.md`, `-3`, …) so the history is not overwritten (see
 * `freeMemoryPath`).
 *
 * By default it assembles the file **directly in TypeScript** as a collage of data
 * mini already has (phase metadata + the verbatim content of the discuss and run
 * report) — without calling the Claude API. The output is longer and rawer than
 * Claude's synthesis, but free and instant.
 *
 * Claude is called **only** when the `memory` model scope is explicitly set
 * (`state.models?.memory != null`) — not when it just inherits from `default`.
 *
 * Memory is **nice-to-have** — it never throws. When the write fails, it only
 * prints a warning and the workflow continues (the phase is already `done` in
 * state.json and the auto-commit already happened).
 *
 * Deliberately **outside the commit** — `commitPhaseWork` ran before, so memory
 * stays unversioned until the next manual commit.
 */
export async function writePhaseMemory(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  options: { hasAutoCommit: boolean },
): Promise<void> {
  const memoryDirAbs = join(cwd, MEMORY_DIR);

  try {
    await mkdir(memoryDirAbs, { recursive: true });
  } catch (err) {
    log.warn(`Failed to write memory for phase ${phase.id}: cannot create ${MEMORY_DIR} (${(err as Error).message}).`);
    return;
  }

  const memoryFileName = await freeMemoryFileName(memoryDirAbs, phase.id);
  const memoryPathRel = join(MEMORY_DIR, memoryFileName);
  const memoryPathAbs = join(cwd, memoryPathRel);

  const discussPath = join(DISCUSS_DIR_REL, `${phaseStem(phase.id)}.md`);
  const runReportPath = join(RUN_DIR_REL, `${phaseStem(phase.id)}.md`);

  // Explicit Claude mode — only when the `memory` scope is set manually via
  // `mini model`. Falling back to the default model is NOT enough to call Claude.
  if (state.models?.memory != null) {
    const ok = await writeViaClaude(phase, state, cwd, {
      memoryPathRel,
      memoryPathAbs,
      discussPath,
      runReportPath,
      hasAutoCommit: options.hasAutoCommit,
    });
    if (!ok) return;
  } else {
    const [discussContent, runContent] = await Promise.all([
      readFileOrEmpty(join(cwd, discussPath)),
      readFileOrEmpty(join(cwd, runReportPath)),
    ]);

    const markdown = buildPhaseMemoryMarkdown(phase, discussContent, runContent);

    try {
      await writeFile(memoryPathAbs, markdown, 'utf-8');
    } catch (err) {
      log.warn(`Failed to write memory for phase ${phase.id}: ${(err as Error).message}`);
      log.hint('Continuing without a memory record.');
      return;
    }

    log.success(`Memory: ${memoryPathRel}`);
  }

  await writeLastMemorySummary(cwd, memoryPathAbs, memoryPathRel);
}

/**
 * Builds the memory file content directly from the phase data and the verbatim
 * content of the discuss and run report. No synthesis — just assembling what mini has.
 */
export function buildPhaseMemoryMarkdown(
  phase: Phase,
  discussContent: string,
  runContent: string,
): string {
  const parts: string[] = [];

  parts.push(`# Phase ${phase.id} — ${phase.title}`);
  parts.push('');
  parts.push(`**Goal:** ${phase.goal?.trim() || '(not specified)'}`);

  if (phase.steps?.length) {
    parts.push('');
    parts.push('## Steps');
    parts.push(phase.steps.map((s) => `- [${STEP_WORD[s.status]}] ${s.title}`).join('\n'));
  }

  if (phase.humanNotes?.trim()) {
    parts.push('');
    parts.push("## User's note");
    parts.push(phase.humanNotes.trim());
  }

  if (phase.autoCommit) {
    parts.push('');
    parts.push('## Auto-commit');
    // The memory file is part of the phase commit, so we cannot know its own sha
    // here (it would depend on itself). Legacy phases still have a sha — when there
    // is one, we show it; otherwise the commit subject is enough.
    const ref = phase.autoCommit.sha ? ` (\`${phase.autoCommit.sha}\`)` : '';
    parts.push(`- ${phase.autoCommit.subject}${ref}`);
  }

  if (discussContent.trim()) {
    parts.push('');
    parts.push(`## ${DISCUSS_SECTION}`);
    parts.push(discussContent.trim());
  }

  if (runContent.trim()) {
    parts.push('');
    parts.push(`## ${RUN_REPORT_SECTION}`);
    parts.push(runContent.trim());
  }

  return `${parts.join('\n')}\n`;
}

/** Upper bound on the summary length (chars). A safeguard so even an unknown
 * memory format (e.g. claude-mode, where Claude writes the memory freely) does
 * not bloat the `next` prompt. */
const SUMMARY_MAX_CHARS = 2000;

/** Patterns of "watch out" headings in the run report — it has free section names
 * (Claude writes them), so we match them with a set of words instead of a fixed
 * anchor. The prompts are English (since phase 76), but older Czech memory must be
 * caught too. */
const RUN_WATCH_RE = /pozor|nález|další fáz|watch out|finding|next phase/i;

/**
 * From the full memory collage (`buildPhaseMemoryMarkdown`) it produces a short
 * summary for the `next` prompt. It keeps the head (header, goal, steps, note,
 * auto-commit) and additionally pulls the most valuable part for proposing the
 * next phase: the `## Watch out for` sub-section from the Discussion block and the
 * "finding / next phase" section from the Run report block. The verbatim Intent,
 * Key decisions and mechanical steps/verification are dropped.
 *
 * It slices by the literal anchors `## Discussion` / `## Run report` produced above
 * — so it can NOT naively split by `## ` (both Discussion and Run report have their
 * own nested `##` headings at the same level). When the anchors are missing (memory
 * in an unknown format), it returns at least a hard length cap.
 */
export function summarizeMemoryForNext(md: string): string {
  const text = md.trimEnd();

  const discussIdx = indexOfSection(text, [DISCUSS_SECTION, DISCUSS_SECTION_LEGACY], 0);
  const runSearchFrom = discussIdx === -1 ? 0 : discussIdx + 1;
  const runIdx = indexOfSection(text, [RUN_REPORT_SECTION], runSearchFrom);

  // Without known anchors we cannot trim structurally — return at least the length safeguard.
  if (discussIdx === -1 && runIdx === -1) {
    return hardCap(text);
  }

  // Head = everything before the first anchor (header, goal, steps, note, auto-commit).
  const headEnd = Math.min(
    discussIdx === -1 ? text.length : discussIdx,
    runIdx === -1 ? text.length : runIdx,
  );
  const parts: string[] = [text.slice(0, headEnd).trimEnd()];

  if (discussIdx !== -1) {
    const discussEnd = runIdx > discussIdx ? runIdx : text.length;
    const watch = extractSubsection(text.slice(discussIdx, discussEnd), (h) => /pozor|watch out/i.test(h));
    if (watch) parts.push(watch);
  }

  if (runIdx !== -1) {
    const finding = extractSubsection(text.slice(runIdx), (h) => RUN_WATCH_RE.test(h));
    if (finding) parts.push(finding);
  }

  // In the structural branch we do NOT hard-cap by length — that would cut the end,
  // i.e. the just-extracted "Watch out for" / "finding" (the most valuable part).
  // The boundary is the section selection.
  return `${parts.join('\n\n').trimEnd()}\n`;
}

/** Finds the start of a `## <name>` line from `fromIndex`, trying each name in
 * order (the producer's English anchor first, then any legacy alias). Returns the
 * index of `#`, or -1. */
function indexOfSection(text: string, names: string[], fromIndex: number): number {
  for (const name of names) {
    const heading = `## ${name}`;
    if (fromIndex === 0 && text.startsWith(heading)) return 0;
    const idx = text.indexOf(`\n${heading}`, fromIndex);
    if (idx !== -1) return idx + 1;
  }
  return -1;
}

/**
 * In a block, finds the first sub-section `## <heading>` whose heading satisfies
 * `matches` and returns it from the heading to the next `## ` (or the end of the
 * block). `null` when nothing matches.
 */
function extractSubsection(block: string, matches: (heading: string) => boolean): string | null {
  const lines = block.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = /^## (.+)$/.exec(lines[i] ?? '');
    if (m && m[1] && matches(m[1])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i] ?? '')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trimEnd();
}

/** Caps the text to `SUMMARY_MAX_CHARS` (cut at a line boundary) and normalizes the end.
 * Used only in the anchor-less fallback — in the structural branch it would cut the most valuable part. */
function hardCap(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed.length <= SUMMARY_MAX_CHARS) {
    return `${trimmed}\n`;
  }
  const slice = trimmed.slice(0, SUMMARY_MAX_CHARS);
  const cut = slice.lastIndexOf('\n');
  const body = (cut > 0 ? slice.slice(0, cut) : slice).trimEnd();
  return `${body}\n\n…(truncated)\n`;
}

/**
 * Runs a Claude print-mode session that writes the memory file. Called only in the
 * explicit mode (`state.models?.memory != null`). Returns `true` when the file was
 * created (and it makes sense to write its summary into last-memory.md).
 */
async function writeViaClaude(
  phase: Phase,
  state: ProjectState,
  cwd: string,
  ctx: {
    memoryPathRel: string;
    memoryPathAbs: string;
    discussPath: string;
    runReportPath: string;
    hasAutoCommit: boolean;
  },
): Promise<boolean> {
  const [discussExists, runExists, projectMd] = await Promise.all([
    fileExists(join(cwd, ctx.discussPath)),
    fileExists(join(cwd, ctx.runReportPath)),
    readProject(cwd).catch(() => ''),
  ]);

  const prompt = buildWriteMemoryPrompt({
    projectMd,
    phase,
    memoryPath: ctx.memoryPathRel,
    discussPath: discussExists ? ctx.discussPath : undefined,
    runReportPath: runExists ? ctx.runReportPath : undefined,
    hasAutoCommit: ctx.hasAutoCommit,
  });

  log.dim(`Writing memory for phase ${phase.id} via Claude into ${ctx.memoryPathRel}…`);

  let response;
  try {
    response = await askClaude(prompt, {
      cwd,
      allowedTools: MEMORY_ALLOWED_TOOLS,
      permissionMode: 'acceptEdits',
      timeoutMs: MEMORY_TIMEOUT_MS,
      model: state.models?.memory,
    });
  } catch (err) {
    log.warn(`Failed to write memory for phase ${phase.id}: ${(err as Error).message}`);
    log.hint('Continuing without a memory record.');
    return false;
  }

  logUsage(response);

  if (!(await fileExists(ctx.memoryPathAbs))) {
    log.warn(`Failed to write memory for phase ${phase.id}: Claude did not create the file ${ctx.memoryPathRel}.`);
    return false;
  }

  log.success(`Memory: ${ctx.memoryPathRel}`);
  return true;
}

/**
 * Writes `.mini/last-memory.md` as a **short summary** of the latest phase. It reads
 * the just-written archive file (the full collage), runs it through
 * `summarizeMemoryForNext` and saves the result — so `last-memory.md` is not a copy
 * of the archive but its slimmed-down version, which `next` then inserts into the
 * prompt (that's why ONLY `next` reads it).
 *
 * It works uniformly for the TS and claude-mode branch: the input is a finished file
 * on disk. The archive `.mini/memory/phase-XXX.md` stays full and untouched.
 *
 * A failure = just `log.dim` — last-memory.md is purely for convenience, the archive
 * is already on disk.
 */
async function writeLastMemorySummary(cwd: string, memoryPathAbs: string, memoryPathRel: string): Promise<void> {
  const lastMemoryAbs = join(cwd, LAST_MEMORY_FILE);

  // The old last-memory.md may still be a symlink from earlier — delete it before writing.
  try {
    await unlink(lastMemoryAbs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.dim(`(failed to delete the old ${LAST_MEMORY_FILE}: ${(err as Error).message})`);
    }
  }

  try {
    const full = await readFile(memoryPathAbs, 'utf-8');
    await writeFile(lastMemoryAbs, summarizeMemoryForNext(full), 'utf-8');
    log.dim(`  ${LAST_MEMORY_FILE} (summary of ${memoryPathRel})`);
  } catch (err) {
    log.dim(`(failed to update ${LAST_MEMORY_FILE}: ${(err as Error).message})`);
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Reads a file as a string; when it does not exist (or the read fails), returns an empty string. */
async function readFileOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Finds a free memory file name for a phase in `dirAbs`. The default is `phase-XXX.md`
 * (padded ID, no date); when it already exists (a repeated `done` of the same phase),
 * it tries `phase-XXX-2.md`, `phase-XXX-3.md`, … until it finds a free one — so the
 * history is never overwritten. Returns only the file name (not the path).
 */
export async function freeMemoryFileName(dirAbs: string, phaseId: number): Promise<string> {
  const stem = phaseStem(phaseId);
  const base = `${stem}.md`;
  if (!(await fileExists(join(dirAbs, base)))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${stem}-${n}.md`;
    if (!(await fileExists(join(dirAbs, candidate)))) return candidate;
  }
}
