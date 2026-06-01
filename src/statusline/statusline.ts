/**
 * mini statusline — renders the one-line status that Claude Code shows at the
 * bottom of the session. Claude Code invokes a `statusLine` command and passes a
 * JSON payload on stdin; this module parses it and produces the line.
 *
 * Everything here is pure (parse → data → string) so it can be unit-tested
 * without a real terminal or transcript. The only IO (reading stdin and the
 * transcript file) lives in the thin CLI wrapper, not here.
 *
 * Context-window usage is NOT part of the status JSON — Claude Code does not
 * report token counts there. We recover it from the session transcript: the
 * last `message.usage` entry holds the tokens currently in the context window.
 * This logic is ported from a hand-written `statusline-command.sh`.
 */

/** The slice of the Claude Code status JSON we care about. */
export interface StatusInput {
  cwd?: string;
  workspace?: { current_dir?: string };
  model?: { display_name?: string };
  transcript_path?: string;
}

/** Parsed, normalized inputs for the renderer. */
export interface StatuslineData {
  /** Absolute working directory (cwd, falling back to workspace.current_dir). */
  dir: string;
  /** Model display name, e.g. "Opus 4.8" (verbatim from the payload). */
  model: string;
  /** Tokens currently in the context window (0 when unknown). */
  usedTokens: number;
  /** Size of the context window in tokens (200_000 or 1_000_000). */
  windowTokens: number;
  /**
   * Latest published version to advertise when a newer one is available on npm
   * (rendered as a `↑ <version>` segment). `null`/`undefined` when up to date or
   * unknown — the segment is then omitted. Sourced from the cache by the command
   * wrapper, never fetched here (the status line must not block on the network).
   */
  upgrade?: string | null;
}

/** Context-window sizes. */
const WINDOW_200K = 200_000;
const WINDOW_1M = 1_000_000;

/**
 * Picks the context-window size from the model name. A 1M window applies to all
 * Sonnet 4.x and to Opus from 4.7 onward; everything else (Haiku, older Opus)
 * stays at 200k. The version is parsed out of the display name ("Opus 4.8" →
 * 4.8). Kept in one place because it goes stale as new models ship — the
 * `used > limit` auto-escalation in `extractUsage` is the safety net.
 */
export function windowForModel(model: string): number {
  const m = model.toLowerCase();
  const match = m.match(/(\d+)\.(\d+)/);
  const version: [number, number] = match
    ? [Number(match[1]), Number(match[2])]
    : [0, 0];
  const atLeast = (maj: number, min: number): boolean =>
    version[0] > maj || (version[0] === maj && version[1] >= min);

  const oneM = m.includes('sonnet') || (m.includes('opus') && atLeast(4, 7));
  return oneM ? WINDOW_1M : WINDOW_200K;
}

/** One JSONL line of a transcript (only the fields we read). */
interface TranscriptLine {
  message?: {
    usage?: {
      input_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

/**
 * Tokens currently in the context window = the LAST `message.usage` entry in the
 * transcript, summing the input + both cache token counts (output tokens are not
 * part of the next turn's context). Malformed lines are skipped. Returns 0 when
 * the transcript has no usable usage entry.
 */
export function extractUsage(transcript: string): number {
  let used = 0;
  for (const line of transcript.split('\n')) {
    if (!line.trim()) continue;
    let parsed: TranscriptLine;
    try {
      parsed = JSON.parse(line) as TranscriptLine;
    } catch {
      continue;
    }
    const u = parsed.message?.usage;
    if (u) {
      used =
        (u.input_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0) +
        (u.cache_creation_input_tokens ?? 0);
    }
  }
  return used;
}

/**
 * Combines the parsed status JSON with the transcript usage into the normalized
 * data the renderer needs. The window auto-escalates to 1M when the usage has
 * already run past the model's base limit — a defensive correction for the case
 * where the model→window mapping underestimates (e.g. a new long-context model).
 */
export function buildData(
  input: StatusInput,
  transcript: string,
  upgrade: string | null = null,
): StatuslineData {
  const dir = input.cwd ?? input.workspace?.current_dir ?? '';
  const model = input.model?.display_name ?? '';
  const used = extractUsage(transcript);
  let window = windowForModel(model);
  if (used > window && window < WINDOW_1M) {
    window = WINDOW_1M;
  }
  return { dir, model, usedTokens: used, windowTokens: window, upgrade };
}
