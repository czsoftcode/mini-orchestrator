/**
 * Canonical instruction on "how to parallelize tool calls". Shared by the
 * execution prompts `do` and `auto`, where the agent actually runs commands and
 * edits files — that is where batching independent calls saves real time, but
 * also where a careless batch (e.g. starting a server alongside other work) does
 * damage. Deliberately NOT in next/discuss/plan: those are read/think prompts
 * with little to parallelize and no stateful commands.
 *
 * Keep the wording tight (token budget) and neutral — it is inserted into the
 * middle of different prompts, so no prompt-specific sentences.
 */
export const PARALLELISM_HINT =
  'On parallelizing tool calls: ' +
  '(1) run fragile/stateful commands on their own — anything touching a server ' +
  '(start/stop, kill, pkill, background jobs) must not share a batch with other work, ' +
  'so a failure or hang is isolated; ' +
  '(2) independent reads and queries can go in parallel — that is safe and saves time; ' +
  '(3) keep dependent steps sequential — when you need one command’s output for the next ' +
  '(e.g. an exact step name), wait for it before continuing.';
