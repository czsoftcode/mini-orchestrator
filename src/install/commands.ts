import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { log } from '../ui/log.js';

/**
 * Target directory for the native slash commands, relative to a root (a project
 * dir or the user home). The `/mini:*` commands live in `.claude/commands/mini/`.
 */
export const COMMANDS_DIR = join('.claude', 'commands', 'mini');

export interface CommandDef {
  /** File name without extension, also the slash command (`/mini:<name>`). */
  name: string;
  description: string;
  /** Optional `argument-hint` for the frontmatter. */
  argumentHint?: string;
  /** Argument after `mini context <name>` (typically `$ARGUMENTS` for next). */
  contextArgs?: string;
  /**
   * Custom .md body (the text under the frontmatter). When missing, the default
   * cycle body is used, which runs `mini context <name>`. Serves read-only
   * commands like `status` that have no session prompt via `mini context`.
   */
  body?: string;
}

/**
 * Command definitions. The body of the workflow commands is deliberately thin:
 * it just runs `mini context <name>` and hands control to the printed prompt. All
 * the logic and current context live in mini (TS), not in frozen markdown.
 * Read-only commands (`status`) have their own `body` and call no `mini context`.
 */
export const COMMAND_DEFS: CommandDef[] = [
  {
    name: 'init',
    description: 'mini — start a new project (questions happen in the session)',
    body: `This is the **init** step of the mini workflow, run directly in Claude Code. You start a new mini project in the current directory. The state in \`.mini/\` is created by the \`mini init --apply …\` command — never write \`.mini/state.json\` or \`.mini/project.md\` by hand.

Proceed in this order:

1. **Ask the user** four things (short answers, in the chat):
   - **project name** (if they say nothing, leave the default = directory name),
   - **what it builds** (1-2 sentences),
   - **who it's for** (the target user),
   - **main constraints** (language/framework/deadline — may be left empty).
2. **Save the project.** Run in Bash:
   \`mini init --apply --name "<name>" --what "<what>" --for-whom "<for whom>" --constraints "<constraints>"\`
   (you can omit \`--name\` and \`--constraints\` when the user left them empty). If the command reports that the project already exists and the user **confirms** overwriting (the old phase history will be lost), repeat the command with \`--force\`. Without confirmation, stop.
3. **Offer the next steps.** From the command output you can tell whether there is already some code in the directory (brownfield):
   - **there is code** → offer the user \`/mini:map\` (project graph) and after it \`/mini:audit\` (codebase overview into \`.mini/codebase.md\`),
   - **empty directory** → offer \`/mini:next\` (propose the first phase).

Briefly relay the command output and the recommended next steps to the user in the chat.`,
  },
  {
    name: 'next',
    description: 'mini — propose and save the next project phase',
    argumentHint: '[optional phase idea]',
    contextArgs: '$ARGUMENTS',
  },
  {
    name: 'discuss',
    description: 'mini — discuss the current phase before planning',
  },
  {
    name: 'plan',
    description: 'mini — break the current phase down into concrete steps',
  },
  {
    name: 'do',
    description: 'mini — implement the current phase and write a report',
    body: `This is the **do** step of the mini workflow, run directly in Claude Code. You implement the current phase and write a report at the end. Change the state in \`.mini/\` only with \`mini ... --apply\` commands, never edit \`.mini/state.json\` by hand.

Proceed in this order:

1. **Start the phase.** Run in Bash \`mini do --apply\` — it marks the phase as in progress (\`doing\`) and creates \`.mini/run/\`, so that the step tracking and the report have somewhere to go. Run it **before** you start implementing.
2. **Load the prompt.** Run \`mini context do\` and follow the printed instructions (project context, steps, report format).
3. **Implement.** After each finished step, mark it done **immediately**: \`mini do --apply --step-done "<exact step name>"\` (copy the name character by character from the "Steps" section in the prompt).
4. **Write the report.** At the end, use the Write tool to save the report into \`.mini/run/phase-{id}.md\` exactly in the format from the prompt (YAML statuses + free text). Only then finish.

If a step runs into a blocker you can't get around yourself, stop and hand control back to the user.`,
  },
  {
    name: 'done',
    description: 'mini — human verification and moving the phase state',
  },
  {
    name: 'verify',
    description: 'mini — in-depth UI/UX review of the phase by a human',
  },
  {
    name: 'status',
    description: 'mini — overview of the project phases (read-only)',
    body: `This is the **status** step of the mini workflow, run directly in Claude Code.

Run in Bash \`mini status\` and relay its output (an overview of the project phases) to the user in the chat. It's a **read-only** step — change no state in \`.mini/\` and save nothing.`,
  },
  {
    name: 'map',
    description: 'mini — regenerate the project graph (supplementary)',
    body: `This is the **map** step of the mini workflow, run directly in Claude Code.

Run in Bash \`mini map\` — it regenerates the project graph (\`.mini/graph/\` + the index \`.mini/graph.json\`) from the source files. Relay the result (the index path and the number of mapped files) from the output to the user in the chat. It does not change the phase state in \`.mini/state.json\` in any way — the graph is just a derivation from the source files.`,
  },
  {
    name: 'audit',
    description: 'mini — overview of the existing codebase into .mini/codebase.md (supplementary)',
    body: `This is the **audit** step of the mini workflow, run directly in Claude Code.

Run in Bash \`mini audit\` — it goes through the existing code and creates/updates \`.mini/codebase.md\` (a codebase overview for later sessions). When done, briefly summarize the result to the user in the chat. It does not change the phase state in \`.mini/state.json\` in any way — it is typically run right after \`/mini:init\` in an existing project, optionally after \`/mini:map\`.`,
  },
  {
    name: 'auto',
    description: 'mini — autonomous mode: completes several phases in a row',
    argumentHint: '[--max-phases N] [--yolo] [--verify] [--discuss] [--bump <level>] [--push]',
    body: `This is the **auto** step of the mini workflow, run directly in Claude Code. You are in **autonomous mode**: in a loop you complete whole phases yourself (next → discuss(conditionally) → plan → do → verify(conditionally) → done) and after finishing one phase you smoothly continue with the next, until you hit one of the run boundaries (see "End of run"). Change the state in \`.mini/\` only with \`mini ... --apply\` commands, never edit \`.mini/state.json\` by hand.

## Run arguments
The user ran the command with arguments: \`$ARGUMENTS\`. Parse from them (leniently, order doesn't matter):
- **\`--max-phases N\`** — how many phases at most to complete in a row. When missing (or unreadable), use the **default 1**.
- **\`--yolo\`** — fully unattended mode (see "Confirming commands"). When missing, run in normal mode.
- **\`--verify\`** — forces the **verify** step (in-depth UI/UX review by a human) in **every** phase of the run, even if it doesn't seem UI/UX to you. Without it you run verify only conditionally (see step 5 of the cycle).
- **\`--discuss\`** — forces the **discuss** step in **every** phase of the run, even if it seems straightforward to you. Without it you run discuss only conditionally (see step 2 of the cycle).
- **\`--bump <level>\`** — version bump level when closing **each** phase (\`patch\` | \`minor\` | \`major\`); passed on to \`mini done --apply\`. When missing, no version bump happens (the \`mini done\` default \`none\`).
- **\`--push\`** — after committing each phase, push to the remote. Requires an explicit \`--bump patch | minor | major\` (the same constraint as \`mini done\`); on its own, or with \`--bump none\`, it makes no sense — point it out once and don't push.

At the start, **once** briefly announce to the user how many phases you'll run and which of the \`--yolo\` / \`--verify\` / \`--discuss\` / \`--bump\` / \`--push\` switches are on.

## The cycle of one phase
For each phase go through these steps in sequence (start the next one only after finishing the previous):

1. **next (stop and ask).** If there is currently **no** phase in progress (after a previous \`done\`, or at the start when the last phase is finished), propose the next one. Run \`mini context next\` and follow the prompt, but **first stop and take an idea/input from the user** for the next phase (autonomous mode does not invent phases blindly). When \`mini context next\` / your proposal concludes that the **project is finished** (TITLE: -), end the cycle cleanly (see "End of run"). If a phase is already in progress (\`proposed\`/\`planned\`/\`doing\`), skip this step.
2. **discuss (conditionally / forced, stop and ask).** Run \`mini context discuss\` when the phase is hard to decide on (an ambiguous goal, multiple directions, something to clarify) **and** a discussion hasn't happened for it yet, **or** always when the run got \`--discuss\`; then interactively gather input from the user and save the notes. For a straightforward phase without \`--discuss\`, **skip** the step.
3. **plan.** Run \`mini context plan\` and break the phase into steps; save via \`mini plan --apply\`. If the phase already has steps, skip.
4. **do (quietly).** Run \`mini do --apply\` and then \`mini context do\`; implement the phase per the instructions. **Don't print edit listings** — don't retell every file change into the chat, just briefly report progress step by step. After each finished step, mark it: \`mini do --apply --step-done "<exact name>"\`. At the end, write the report into \`.mini/run/phase-{id}.md\`.
5. **verify (conditionally, stop and let it be reviewed).** Run this step when the phase is **UI/UX in nature** — it has a visible output only a human can judge (appearance, CLI/screen, UX flow, clarity); judge that from the phase goal, the steps and the report. **Or** run it always when the run got \`--verify\`. For a purely internal phase (refactor, parser, build, tests with no visible output) and without \`--verify\`, **skip** verify. When it runs: leave the report from \`do\` written, run \`mini context verify\` and take the human through an in-depth UI/UX review per the prompt (ask one at a time). The findings are written into the report (the prompt guides you), so they reach the memory through the report too. **If problems are found, don't close the phase** — go back to \`do\`, fix them within this phase, update the report and only then continue to \`done\`. Verify is human-driven — **auto does not bypass it**.
6. **done.** Run \`mini context done\` and move the state; the final save is \`mini done --apply\`, to which you append the version switches the run got: \`mini done --apply [--bump <level>] [--push]\` (e.g. \`mini done --apply --bump patch --push\` for \`--bump patch --push\`; without those switches just \`mini done --apply\`). Remember \`--push\` requires an explicit \`--bump patch | minor | major\` — without it (or with \`--bump none\`) don't push. For **items for manual verification (verify)**, **stop and let the user verify** — auto does not bypass verify.

Between steps and between phases, briefly report to the user where you got (without flooding the chat).

## Confirming commands
In **normal** mode you leave confirming bash commands to the user (it's governed by the session's permission mode, or an allowlist in \`.claude/settings.json\`). In **\`--yolo\`** mode you shouldn't burden the user with prompts — but that only works when the session **runs in acceptEdits** (start Claude Code with \`--permission-mode acceptEdits\`, or switch it within the session). The slash command itself does not turn off confirmation. When you get \`--yolo\` but the session isn't in acceptEdits, point it out once and continue normally.

## Stop hooks (cooperative stopping)
At these **checkpoints** check whether you should finish cleanly (when the file \`.mini/STOP\` exists, finish the step in progress, write the report and finish with the message "Stopped on request"; otherwise continue). The signal is created by the user from another terminal with the \`mini stop\` command (cleared by \`mini stop --clear\`) — you only read the file at these points:
- **between cycle steps** — before each further \`mini context …\` call,
- **after each finished step in \`do\`** — right after \`mini do --apply --step-done "…"\`.
(The whole-phase boundary is automatically included in that.) Stopping is necessarily cooperative — you wouldn't read a message written into this session during work anyway; a hard interruption mid-step is on Esc/Ctrl+C.

## End of run
End the cycle (and briefly summarize what happened) when any of the boundaries occurs:
- you completed **\`--max-phases\`** phases,
- \`next\` concluded that the **project is finished**,
- you hit a **blocker** you can't get around yourself — stop and hand control to the user (don't force the rest),
- a **stop hook** fired.`,
  },
];

/** Renders the content of a single .md command. */
export function renderCommandMd(def: CommandDef): string {
  const front = [`description: ${def.description}`];
  if (def.argumentHint) {
    front.push(`argument-hint: ${def.argumentHint}`);
  }

  const contextCall = def.contextArgs
    ? `mini context ${def.name} ${def.contextArgs}`
    : `mini context ${def.name}`;
  const body =
    def.body ??
    `This is the **${def.name}** step of the mini workflow, run directly in Claude Code.

Run in Bash \`${contextCall}\` and follow the printed instructions **exactly**. The prompt contains the current project context as well as how to save the state at the end (via \`mini ... --apply\`). Change the state in \`.mini/\` only with those commands — never edit \`.mini/state.json\` by hand.`;

  return `---
${front.join('\n')}
---

${body}
`;
}

export interface WriteCommandsOptions {
  /** Preview only — write nothing, return the counts as if it had been written. */
  dryRun?: boolean;
  /**
   * Directory shown in the per-file log lines (`Created: <displayDir>/next.md`).
   * Defaults to `targetDir`. Use a short/relative form (e.g. `.claude/commands/mini`
   * or `~/.claude/commands/mini`) so the output stays readable.
   */
  displayDir?: string;
}

export interface WriteCommandsResult {
  created: number;
  updated: number;
  unchanged: number;
}

/**
 * Writes all slash-command `.md` files into `targetDir` (an absolute path to a
 * `.claude/commands/mini` directory). Idempotent and diff-based: overwrites only
 * what differs (atomically via tmp+rename) and logs each created/changed file.
 * With `dryRun` it only counts and prints what would happen, touching no disk.
 *
 * This is the single source of truth for generating the commands — the project
 * installer (`installCommands`), `mini update` and the npm postinstall hook all
 * go through it, so their output can't drift.
 */
export async function writeCommandsTo(
  targetDir: string,
  { dryRun = false, displayDir }: WriteCommandsOptions = {},
): Promise<WriteCommandsResult> {
  const shownDir = displayDir ?? targetDir;
  if (!dryRun) {
    await mkdir(targetDir, { recursive: true });
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const def of COMMAND_DEFS) {
    const path = join(targetDir, `${def.name}.md`);
    const content = renderCommandMd(def);

    let old: string | null = null;
    try {
      old = await readFile(path, 'utf-8');
    } catch {
      old = null;
    }

    if (old === content) {
      unchanged++;
      continue;
    }

    if (!dryRun) {
      const tmp = `${path}.tmp`;
      await writeFile(tmp, content, 'utf-8');
      await rename(tmp, path);
    }

    const rel = join(shownDir, `${def.name}.md`);
    if (old === null) {
      created++;
      log.success(dryRun ? `Will be created: ${rel}` : `Created: ${rel}`);
    } else {
      updated++;
      log.success(dryRun ? `Will change: ${rel}` : `Updated: ${rel}`);
    }
  }

  if (unchanged > 0) {
    log.dim(`${unchanged} ${unchanged === 1 ? 'command' : 'commands'} unchanged.`);
  }

  return { created, updated, unchanged };
}
