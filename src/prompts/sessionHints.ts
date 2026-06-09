/**
 * Canonical instructions that harden the session prompts against the behavior
 * of newer model generations (Opus 4.7/4.8, Fable 5). Those models are tuned to
 * be concise between tool calls and to avoid blocking questions, so soft
 * phrasing like "relay the output" or "ask the user" gets compressed into a
 * one-line summary or skipped entirely. These hints state the two contracts
 * explicitly:
 *
 * - `VERBATIM_OUTPUT_HINT` — command output shown to the user must be printed
 *   verbatim in the final message; the user does not read the Bash tool result.
 * - `ASK_AND_STOP_HINT` — a question to the user ends the turn; no state change
 *   (`mini ... --apply`) may happen in the same turn as the question.
 *
 * Shared by the session prompts (`sessionContext.ts`) and the slash-command
 * bodies (`install/commands.ts`). Keep the wording tight (token budget) and
 * neutral — it is inserted into the middle of different prompts, so no
 * prompt-specific sentences.
 */

export const VERBATIM_OUTPUT_HINT =
  'Print the complete command output verbatim in your final message to the user — ' +
  'do not summarize, shorten or reformat it. ' +
  'The user does not read the Bash tool result; what you do not print, they never see.';

export const ASK_AND_STOP_HINT =
  'Ask, then END YOUR TURN and wait for the user to answer in their next message. ' +
  'Never run a state-changing command (`mini ... --apply` or similar) in the same turn ' +
  'as the question — the approval must come from the user, not from you.';
