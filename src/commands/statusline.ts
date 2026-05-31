/**
 * `mini statusline` — the command Claude Code runs to render its status line.
 *
 * Claude Code pipes the status JSON on stdin and shows whatever the command
 * prints on stdout. This wrapper does the IO (read stdin, read the transcript
 * file) and delegates the actual logic to the pure `src/statusline/` module.
 *
 * Deliberately lean: it imports only the statusline module and Node builtins, no
 * heavy CLI/graph dependencies, because Claude Code re-runs it on every refresh
 * and a slow startup would be visible. It also never throws — a status line that
 * errors would just clutter the UI — so on any failure it prints nothing.
 */

import { readFile } from 'node:fs/promises';
import { buildData, type StatusInput } from '../statusline/statusline.js';
import { renderStatusline } from '../statusline/render.js';

/** Reads all of stdin as a UTF-8 string. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export async function statusline(): Promise<void> {
  try {
    const raw = await readStdin();
    const input = JSON.parse(raw) as StatusInput;

    let transcript = '';
    if (input.transcript_path) {
      transcript = await readFile(input.transcript_path, 'utf-8').catch(() => '');
    }

    const line = renderStatusline(buildData(input, transcript));
    if (line) process.stdout.write(line);
  } catch {
    // A status line must never fail loudly — print nothing and exit cleanly.
  }
}
