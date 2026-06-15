#!/usr/bin/env node
import { Command, InvalidArgumentError, Option } from 'commander';
import { readPackageVersion } from './version.js';
// --source choices derive from FINDING_SOURCES so the CLI cannot drift from the
// data model (a past blocker: the enum gained 'project' but the CLI choices were
// never updated, making the adversarial-project workflow unrecordable).
import { FINDING_SOURCES } from './state/findingsStore.js';

const program = new Command();

function parseMaxTurns(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError('Must be a positive integer (e.g. 5).');
  }
  return n;
}

function parsePhaseNumber(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError('Must be a phase number (a positive integer, e.g. 12).');
  }
  return n;
}

/**
 * `--push` is a release, so it requires an explicit version level. The default
 * `none` (or `--bump none`) with push makes no sense — there would be nothing to
 * tag. Print a message and exit the process.
 */
function ensurePushHasBump(bump: string | undefined, push: boolean | undefined): void {
  if (push && (bump === undefined || bump === 'none')) {
    console.error('With --push you must choose a version level: --bump patch | minor | major.');
    process.exit(1);
  }
}

/** Collector for the repeatable `--file` option of the `map` command. */
function collectFile(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/**
 * Extracts the edited file path from the hook JSON on stdin (PostToolUse Edit/Write).
 * The payload has the shape `{ tool_input: { file_path: "…" } }`. Anything unreadable
 * or without a path → `null` (the hook then silently no-ops, never blocks).
 */
async function readHookFilePath(): Promise<string | null> {
  let raw: string;
  try {
    raw = await readStdin();
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(raw) as { tool_input?: { file_path?: unknown } };
    const p = payload?.tool_input?.file_path;
    return typeof p === 'string' && p.length > 0 ? p : null;
  } catch {
    return null;
  }
}

/** Reads the whole stdin into a string. For non-interactive `--apply` commands. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function requireOption(value: string | undefined, flag: string): string {
  const v = (value ?? '').trim();
  if (v.length === 0) {
    console.error(`Missing required option ${flag}.`);
    process.exit(1);
  }
  return v;
}

program
  .name('mini')
  .description('Mini orchestrator on top of Claude Code — keeps the project state and sends Claude only the essentials.')
  .version(readPackageVersion());

program
  .command('init')
  .description('Creates a new project in the current directory.')
  .option('--apply', 'Non-interactively create the project from flags (no questions). For /mini:init.')
  .option('--name <name>', 'Project name (with --apply; defaults to the directory name).')
  .option('--what <what>', 'What you are building (with --apply).')
  .option('--for-whom <forWhom>', 'Who it is for (with --apply).')
  .option('--constraints <constraints>', 'Main constraints (with --apply; optional).')
  .option('--force', 'Overwrite an existing project without asking (with --apply).')
  .action(
    async (opts: {
      apply?: boolean;
      name?: string;
      what?: string;
      forWhom?: string;
      constraints?: string;
      force?: boolean;
    }) => {
      if (opts.apply) {
        const what = requireOption(opts.what, '--what');
        const forWhom = requireOption(opts.forWhom, '--for-whom');
        const { applyInit } = await import('./commands/init.js');
        const r = await applyInit({
          name: opts.name,
          what,
          forWhom,
          constraints: opts.constraints,
          force: opts.force,
        });
        if (!r.ok) process.exit(1);
        return;
      }
      const { init } = await import('./commands/init.js');
      await init();
    },
  );

program
  .command('next')
  .description('Proposes what should come as the next phase.')
  .option('--apply', 'Non-interactively save a phase from --title/--goal (no Claude). For /mini:next.')
  .option('--title <title>', 'Title of the new phase (with --apply).')
  .option('--goal <goal>', 'Goal of the new phase (with --apply).')
  .option(
    '--from-todo <n>',
    'Tick off backlog item number <n> (mini todo) after saving the phase (with --apply).',
  )
  .option(
    '--from-finding <id>',
    'Record that the phase fixes adversarial finding <id> (e.g. 155-1); the finding stays open (with --apply).',
  )
  .action(
    async (opts: {
      apply?: boolean;
      title?: string;
      goal?: string;
      fromTodo?: string;
      fromFinding?: string;
    }) => {
      if (opts.apply) {
        const title = requireOption(opts.title, '--title');
        const goal = requireOption(opts.goal, '--goal');
        const fromTodo = opts.fromTodo !== undefined ? Number(opts.fromTodo) : undefined;
        const { applyNewPhase } = await import('./commands/next.js');
        const r = await applyNewPhase(title, goal, {
          ...(fromTodo !== undefined ? { fromTodo } : {}),
          ...(opts.fromFinding !== undefined ? { fromFinding: opts.fromFinding } : {}),
        });
        if (!r.ok) process.exit(1);
        return;
      }
      const { next } = await import('./commands/next.js');
      await next();
    },
  );

program
  .command('plan')
  .description('Breaks the current phase down into concrete steps.')
  .option('--apply', 'Non-interactively save steps read from stdin (one per line `title :: detail`, detail optional, no Claude). For /mini:plan.')
  .action(async (opts: { apply?: boolean }) => {
    if (opts.apply) {
      const { applyPlanSteps, parseStepsFromStdin } = await import('./commands/plan.js');
      const steps = parseStepsFromStdin(await readStdin());
      const r = await applyPlanSteps(steps);
      if (!r.ok) process.exit(1);
      return;
    }
    const { plan } = await import('./commands/plan.js');
    await plan();
  });

program
  .command('do')
  .description('Runs Claude Code on the current phase or step.')
  .option('--stream', 'Run Claude in non-interactive print mode with streamed JSON output (shows the current action live, summarizes cost and tokens at the end).')
  .option('--max-turns <n>', 'Maximum number of Claude Code responses in the session — after N responses the session stops automatically (saves tokens).', parseMaxTurns)
  .option('--apply', 'Non-interactively mark the phase as in progress and create .mini/run/ (no Claude). For /mini:do.')
  .option('--step-done <title>', 'With --apply: mark one step of the current phase as done (live tracking during /mini:do).')
  .action(async (opts: { stream?: boolean; maxTurns?: number; apply?: boolean; stepDone?: string }) => {
    if (opts.apply) {
      if (opts.stepDone !== undefined) {
        const { applyStepDone } = await import('./commands/do.js');
        const r = await applyStepDone(opts.stepDone);
        if (!r.ok) process.exit(1);
        return;
      }
      const { applyDoStart } = await import('./commands/do.js');
      const r = await applyDoStart();
      if (!r.ok) process.exit(1);
      return;
    }
    const { doPhase } = await import('./commands/do.js');
    await doPhase({ stream: opts.stream, maxTurns: opts.maxTurns });
  });

program
  .command('done')
  .description('Human verification — asks whether it works and moves the state forward.')
  .option('--apply', 'Non-interactively move the state according to the report (no questions). For /mini:done.')
  .option('--accept-verify', 'With --apply: treat items for manual verification as approved (verification happened in the chat).')
  .addOption(
    new Option(
      '--bump <level>',
      'Version bump level in package.json when closing the phase: none | patch | minor | major (default none — do not bump). With --push patch | minor | major is required.',
    ).choices(['none', 'patch', 'minor', 'major']),
  )
  .option('--push', 'After committing the phase, push to the remote (git push). Requires --bump patch | minor | major.')
  .action(async (opts: { apply?: boolean; acceptVerify?: boolean; bump?: 'patch' | 'minor' | 'major' | 'none'; push?: boolean }) => {
    ensurePushHasBump(opts.bump, opts.push);
    if (opts.apply) {
      const { applyDone } = await import('./commands/done.js');
      const r = await applyDone(process.cwd(), {
        acceptVerify: opts.acceptVerify,
        bump: opts.bump,
        push: opts.push,
      });
      if (!r.ok) process.exit(1);
      return;
    }
    const { done } = await import('./commands/done.js');
    await done({ bump: opts.bump, push: opts.push });
  });

program
  .command('decision')
  .description('Writes the current phase\'s decision record (ADR) to .mini/decisions/ from stdin. For /mini:done; run before mini done --apply.')
  .option('--apply', 'Non-interactively write the ADR body read from stdin (empty stdin or a body without a "# " heading writes nothing). For /mini:done.')
  .action(async (opts: { apply?: boolean }) => {
    if (!opts.apply) {
      console.error('mini decision needs --apply (the ADR body is read from stdin).');
      process.exit(1);
    }
    const { applyDecision } = await import('./commands/decision.js');
    const r = await applyDecision(await readStdin());
    if (!r.ok) process.exit(1);
  });

program
  .command('auto')
  .description('Auto chain: next → plan → (do → done){for each step}. Drives the phase on its own, but stops and asks a human at items for manual verification (verify) — it is not a fully unattended run.')
  .option('--max-turns <n>', 'Maximum number of Claude Code responses in each session — after N responses the session stops automatically (saves tokens).', parseMaxTurns)
  .addOption(
    new Option(
      '--bump <level>',
      'Version bump level in package.json when closing the phase: none | patch | minor | major (default none — do not bump). With --push patch | minor | major is required.',
    ).choices(['none', 'patch', 'minor', 'major']),
  )
  .option('--push', 'After committing the phase, push to the remote (git push). Requires --bump patch | minor | major.')
  .action(async (opts: { maxTurns?: number; bump?: 'patch' | 'minor' | 'major' | 'none'; push?: boolean }) => {
    ensurePushHasBump(opts.bump, opts.push);
    const { auto } = await import('./commands/auto.js');
    await auto({ maxTurns: opts.maxTurns, bump: opts.bump, push: opts.push });
  });

program
  .command('discuss')
  .description('Opens an interactive Claude Code session focused on the current phase — lets you discuss the intent before planning.')
  .action(async () => {
    const { discuss } = await import('./commands/discuss.js');
    await discuss();
  });

program
  .command('project')
  .description('Enriches the existing project.md (approach, non-goals, success criteria) — an interactive session, or --apply to save a contract from stdin.')
  .option('--apply', 'Non-interactively read the project contract from stdin (NAME/WHAT/FOR_WHOM/CONSTRAINTS/APPROACH/NON_GOALS/SUCCESS), parse it and write only project.md (no Claude). For /mini:project.')
  .action(async (opts: { apply?: boolean }) => {
    if (opts.apply) {
      const { parseProjectContract, applyProject } = await import('./commands/project.js');
      const parsed = parseProjectContract(await readStdin());
      if (!parsed) {
        console.error(
          'Could not read the project contract (it needs at least a NAME: and a WHAT: line, each starting at the beginning of a line).',
        );
        process.exit(1);
      }
      const r = await applyProject(parsed);
      if (!r.ok) process.exit(1);
      return;
    }
    const { projectSession } = await import('./commands/project.js');
    await projectSession();
  });

program
  .command('verify')
  .description('Opens an interactive Claude Code session for the in-depth UI/UX review of the current phase (or the last closed one) — symmetric to discuss, the terminal counterpart of /mini:verify.')
  .action(async () => {
    const { verify } = await import('./commands/verify.js');
    await verify();
  });

program
  .command('adversarial')
  .description('Opens a fresh Claude Code session for an independent red-team review of the current phase (or the last closed one) — finds what breaks the code and records findings into the .mini/findings/ store via `mini findings add` (report only, never edits code); the terminal counterpart of /mini:adversarial.')
  .action(async () => {
    const { adversarial } = await import('./commands/adversarial.js');
    await adversarial();
  });

program
  .command('adversarial-project')
  .description('Opens a fresh Claude Code session for an independent red-team review of a *range of phases* — given by phase numbers (--from-phase/--to-phase) or git refs (--from/--to). Report only (records findings via `mini findings add`, never edits code); the terminal counterpart of /mini:adversarial-project.')
  .option('--from-phase <n>', 'Range start as a phase number (use together with --to-phase).', parsePhaseNumber)
  .option('--to-phase <n>', 'Range end as a phase number (use together with --from-phase).', parsePhaseNumber)
  .option('--from <ref>', 'Range start as a git ref (use together with --to; cannot mix with phase flags).')
  .option('--to <ref>', 'Range end as a git ref (use together with --from; cannot mix with phase flags).')
  .action(async (opts: { fromPhase?: number; toPhase?: number; from?: string; to?: string }) => {
    const { adversarialProject } = await import('./commands/adversarialProject.js');
    await adversarialProject({
      fromPhase: opts.fromPhase,
      toPhase: opts.toPhase,
      from: opts.from,
      to: opts.to,
    });
  });

program
  .command('security')
  .description('Opens a fresh Claude Code session for an independent *security review*. With no flags it reviews the last completed phase; --from-phase/--to-phase or --from/--to review a range. Report only — the reviewer writes a Markdown report to .mini/security/<range>.md and never edits code.')
  .option('--from-phase <n>', 'Range start as a phase number (use together with --to-phase).', parsePhaseNumber)
  .option('--to-phase <n>', 'Range end as a phase number (use together with --from-phase).', parsePhaseNumber)
  .option('--from <ref>', 'Range start as a git ref (use together with --to; cannot mix with phase flags).')
  .option('--to <ref>', 'Range end as a git ref (use together with --from; cannot mix with phase flags).')
  .action(async (opts: { fromPhase?: number; toPhase?: number; from?: string; to?: string }) => {
    const { security } = await import('./commands/security.js');
    await security({
      fromPhase: opts.fromPhase,
      toPhase: opts.toPhase,
      from: opts.from,
      to: opts.to,
    });
  });

program
  .command('undo')
  .description('Reverts the last state change by one step.')
  .option('--dry-run', 'Preview only — print what would be reverted and exit, without prompting or changing anything. For /mini:undo.')
  .option('--yes', 'Skip the confirmation and revert directly (non-interactive). For /mini:undo, after the user confirmed in the chat.')
  .action(async (opts: { dryRun?: boolean; yes?: boolean }) => {
    const { undo } = await import('./commands/undo.js');
    await undo({ dryRun: opts.dryRun, yes: opts.yes });
  });

program
  .command('status')
  .description('Shows where we currently are in the project. With --json prints a machine-readable object.')
  .option('--json', 'Print a machine-readable JSON object instead of the human overview.')
  .option('--phase <n>', 'Show the detail of a single phase (steps + detail + run report) instead of the overview.')
  .action(async (opts: { json?: boolean; phase?: string }) => {
    let phase: number | undefined;
    if (opts.phase !== undefined) {
      phase = Number(opts.phase);
      if (!Number.isFinite(phase)) {
        console.error(`Invalid --phase value: "${opts.phase}". Give a phase number (e.g. 12).`);
        process.exit(1);
      }
    }
    const { status } = await import('./commands/status.js');
    await status({ json: opts.json, phase });
  });

program
  .command('stop')
  .description(
    'Creates a cooperative stop signal (.mini/STOP) — an autonomous /mini:auto finishes the current step and exits cleanly. With --clear it removes the signal.',
  )
  .option('--clear', 'Removes the stop signal instead of creating it.')
  .action(async (opts: { clear?: boolean }) => {
    const { stop } = await import('./commands/stop.js');
    await stop({ clear: opts.clear });
  });

program
  .command('todo [action] [args...]')
  .description(
    'Ideas/changes archive (.mini/todo.md). "mini todo" or "mini todo list" lists items; "add <text>" appends one; "done <n>" / "remove <n>" act on the listed number. mini next offers the open items as candidate phase ideas.',
  )
  .action(async (action?: string, args?: string[]) => {
    const { todo } = await import('./commands/todo.js');
    await todo(action, args ?? []);
  });

program
  .command('findings [action]')
  .description(
    'Review findings store (.mini/findings/). "mini findings add --severity <s> --title <t> [--source <src>] [--where <w>] [--body <b>]" records a finding about the phase under review (the adversarial/verify review steps call this instead of editing the run report); --source is adversarial | verify | project (default adversarial). "mini findings list [--all]" lists open findings across phases (--all includes resolved).',
  )
  .addOption(
    new Option(
      '--severity <level>',
      'Finding severity (for add): blocker | should-know | nit.',
    ).choices(['blocker', 'should-know', 'nit']),
  )
  .addOption(
    new Option(
      '--source <step>',
      'Which review step found it (for add): adversarial | verify | project. Defaults to adversarial.',
    ).choices([...FINDING_SOURCES]),
  )
  .option('--title <text>', 'Short headline of the finding (for add).')
  .option('--where <loc>', 'Optional location file:line (for add).')
  .option('--body <text>', 'Optional longer body — what breaks and how (for add).')
  .option('--all', 'For list: include resolved findings, not just the open ones.')
  .action(
    async (
      action: string | undefined,
      opts: {
        severity?: string;
        source?: string;
        title?: string;
        where?: string;
        body?: string;
        all?: boolean;
      },
    ) => {
      switch ((action ?? 'list').toLowerCase()) {
        case 'add': {
          const { findingsAdd } = await import('./commands/findings.js');
          const r = await findingsAdd({
            severity: opts.severity,
            source: opts.source,
            title: opts.title,
            where: opts.where,
            body: opts.body,
          });
          if (!r.ok) process.exit(1);
          return;
        }
        case 'list': {
          const { findingsList } = await import('./commands/findings.js');
          await findingsList({ all: opts.all });
          return;
        }
        default:
          console.error(`Unknown action "${action}". Use: add | list.`);
          process.exit(1);
      }
    },
  );

program
  .command('changelog [version]')
  .description(
    "Shows the project's CHANGELOG.md changes: by default the latest released version's section, a [version] argument for a specific version, --all for the whole history, --unreleased for the pending section.",
  )
  .option('--all', 'Print the whole changelog instead of a single section.')
  .option('--unreleased', 'Print the pending [Unreleased] section.')
  .action(async (version: string | undefined, opts: { all?: boolean; unreleased?: boolean }) => {
    const { changelog } = await import('./commands/changelog.js');
    await changelog({ all: opts.all, unreleased: opts.unreleased, version });
  });

program
  .command('doctor')
  .description(
    'Quick health check of the project setup: state and schema version, project.md/CHANGELOG.md, installed slash commands and mini version freshness. Read-only.',
  )
  .action(async () => {
    const { doctor } = await import('./commands/doctor.js');
    await doctor();
  });

program
  .command('import-gsd')
  .description('One-off import of an in-progress GSD project from .planning/.')
  .option('--prompt', 'Print the GSD extraction prompt to stdout and exit (no Claude, no project needed). For /mini:import-gsd.')
  .option('--apply', 'Non-interactively read the extraction response from stdin, parse it and save the project + phases (no Claude). For /mini:import-gsd.')
  .option('--force', 'With --apply: overwrite an existing project (its model config is preserved).')
  .action(async (opts: { prompt?: boolean; apply?: boolean; force?: boolean }) => {
    if (opts.prompt) {
      const { buildImportGsdPrompt } = await import('./prompts/importGsd.js');
      const text = buildImportGsdPrompt();
      process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
      return;
    }
    if (opts.apply) {
      const { applyImport } = await import('./commands/import-gsd.js');
      const r = await applyImport(await readStdin(), { force: opts.force });
      if (!r.ok) process.exit(1);
      return;
    }
    const { importGsd } = await import('./commands/import-gsd.js');
    await importGsd();
  });

program
  .command('migrate')
  .description('Converts the old monolithic state.json (version 1) to the new layout (.mini/phases/ + header). Idempotent — does nothing on an already migrated state.')
  .option('--renumber', 'Renumber the phases to consecutive integers (1..N by their order in state.json) and unify file names in phases/discuss/run/memory to phase-XXX. Idempotent.')
  .option('--dry-run', 'With --renumber: only print a preview of the mapping and renames, write nothing.')
  .action(async (opts: { renumber?: boolean; dryRun?: boolean }) => {
    if (opts.renumber) {
      const { renumber } = await import('./commands/renumber.js');
      const confirm = async (): Promise<boolean> => {
        const { ask } = await import('./ui/ask.js');
        const res = await ask({
          type: 'confirm',
          name: 'ok',
          message: 'Perform the renumbering and file renaming?',
          initial: false,
        });
        return (res as { ok?: boolean }).ok === true;
      };
      const r = await renumber(process.cwd(), { dryRun: opts.dryRun, confirm: opts.dryRun ? undefined : confirm });
      if (!r.ok) process.exit(1);
      return;
    }
    const { migrate } = await import('./commands/migrate.js');
    const r = await migrate();
    if (!r.ok) process.exit(1);
  });

program
  .command('audit')
  .description('Goes through the existing code and creates/updates .mini/codebase.md (an overview for later Claude sessions).')
  .action(async () => {
    const { audit } = await import('./commands/audit.js');
    await audit();
  });

program
  .command('map')
  .description('Regenerates the machine-readable project map into .mini/graph/ + the index .mini/graph.json — exports, imports and signatures of TS/PHP/Rust/Python/Go/Java/C#/Kotlin/Swift/Ruby files.')
  .option(
    '--file <path>',
    'Incrementally remap only the given file (node + index record), can be repeated. Without this flag a full rebuild runs.',
    collectFile,
    [],
  )
  .option(
    '--hook',
    'Read the edited file path from the hook JSON on stdin (PostToolUse Edit/Write) and remap it incrementally. Silently no-ops when the payload has no path.',
  )
  .action(async (opts: { file: string[]; hook?: boolean }) => {
    const { map } = await import('./commands/map.js');
    if (opts.hook) {
      const fromHook = await readHookFilePath();
      // No path (different tool / unreadable payload) → silent no-op, not a full rebuild.
      if (!fromHook) return;
      await map([...opts.file, fromHook]);
      return;
    }
    await map(opts.file.length > 0 ? opts.file : undefined);
  });

program
  .command('context <cmd> [args...]')
  .description('Prints the current session prompt for the given step (next|project|discuss|plan|do|done|decision|verify|adversarial|adversarial-project|security) to stdout. Serves the native /mini: slash commands in Claude Code. The range flags (--from-phase/--to-phase, --from/--to) apply to the adversarial-project and security sub-commands; security with no flags reviews the last completed phase.')
  .option('--from-phase <n>', 'adversarial-project/security range start as a phase number (use together with --to-phase).', parsePhaseNumber)
  .option('--to-phase <n>', 'adversarial-project/security range end as a phase number (use together with --from-phase).', parsePhaseNumber)
  .option('--from <ref>', 'adversarial-project/security range start as a git ref (use together with --to; cannot mix with phase flags).')
  .option('--to <ref>', 'adversarial-project/security range end as a git ref (use together with --from; cannot mix with phase flags).')
  .action(
    async (
      cmd: string,
      args: string[],
      opts: { fromPhase?: number; toPhase?: number; from?: string; to?: string },
    ) => {
      const { context } = await import('./commands/context.js');
      await context(cmd, args, {
        fromPhase: opts.fromPhase,
        toPhase: opts.toPhase,
        from: opts.from,
        to: opts.to,
      });
    },
  );

program
  .command('update')
  .description('Alias for `mini upgrade` — checks npm for a newer mini-orchestrator and installs it. Kept so that `mini update` does the expected thing; see `mini upgrade` for the canonical command.')
  .option('--check', 'Only check and report the latest published version; do not install.')
  .option('--yes', 'Skip the confirmation and install directly (non-interactive).')
  .action(async (opts: { check?: boolean; yes?: boolean }) => {
    const { upgrade } = await import('./commands/upgrade.js');
    const r = await upgrade({ check: opts.check, yes: opts.yes });
    if (!r.ok) process.exit(1);
  });

program
  .command('upgrade')
  .description('Checks npm for a newer mini-orchestrator and installs it (npm install -g mini-orchestrator@latest). Reports current → latest and asks before installing.')
  .option('--check', 'Only check and report the latest published version; do not install.')
  .option('--yes', 'Skip the confirmation and install directly (non-interactive). For /mini:upgrade.')
  .action(async (opts: { check?: boolean; yes?: boolean }) => {
    const { upgrade } = await import('./commands/upgrade.js');
    const r = await upgrade({ check: opts.check, yes: opts.yes });
    if (!r.ok) process.exit(1);
  });

program
  .command('statusline')
  .description(
    'Renders the mini status line for Claude Code. Reads the status JSON on stdin and prints one line: shortened project dir, model, and context-window usage. Meant to be wired into ~/.claude/settings.json as a statusLine command, not run by hand.',
  )
  .action(async () => {
    const { statusline } = await import('./commands/statusline.js');
    await statusline();
  });

// Hidden best-effort helper: refreshes the npm latest-version cache. The status
// line spawns it detached when its cache is stale; it is not meant to be run by
// hand (use `mini upgrade --check` for that).
program
  .command('check-version', { hidden: true })
  .description('Refreshes the cached latest published version from npm (used by the status line).')
  .action(async () => {
    const { checkVersion } = await import('./commands/statusline.js');
    await checkVersion();
  });

// Installs the slash commands by hand — the npm `postinstall` hook is the usual
// path, but this is also the zero-touch trial entry point: `npx mini-orchestrator
// install-commands` runs it one-off and, with a TTY, asks where to install
// (project vs user) without writing anything globally on its own. Also covers
// installs where postinstall was skipped (`--ignore-scripts`, `npm ci`, CI).
program
  .command('install-commands')
  .description('Installs the /mini:* slash commands. Idempotent. Asks project vs user when interactive; override with --user/--project.')
  .option('--user', 'Install into the user-level ~/.claude/commands/mini (all projects).')
  .option('--project', 'Install into the current project .claude/commands/mini.')
  .option('--dry-run', 'Preview only — print what would be created/changed, but write nothing.')
  .action(async (opts: { user?: boolean; project?: boolean; dryRun?: boolean }) => {
    const { installSlashCommands } = await import('./install/install.js');
    const scope = opts.user ? 'user' : opts.project ? 'project' : undefined;
    await installSlashCommands({ scope, dryRun: opts.dryRun });
  });

program
  .command('install-statusline')
  .description(
    "Enables the mini status line by adding a statusLine block to ~/.claude/settings.json. Opt-in counterpart to the install — never overwrites an existing/foreign status line. Use --dry-run to preview.",
  )
  .option('--dry-run', 'Preview only — print what would happen, change nothing.')
  .action(async (opts: { dryRun?: boolean }) => {
    const { installStatuslineCommand } = await import('./commands/install-statusline.js');
    await installStatuslineCommand({ dryRun: opts.dryRun });
  });

program
  .command('uninstall')
  .description(
    "Removes the /mini:* slash commands (user-scope ~/.claude/commands/mini and the project-scope .claude/commands/mini) and mini's own status line from ~/.claude/settings.json. A foreign status line is left intact. Run this BEFORE `npm uninstall -g mini-orchestrator` (which does not run it for you and removes the mini binary); afterwards use `npx mini-orchestrator uninstall`.",
  )
  .option('--dry-run', 'Preview only — print what would be removed, change nothing.')
  .option('-y, --yes', 'Skip the confirmation prompt.')
  .action(async (opts: { dryRun?: boolean; yes?: boolean }) => {
    const { uninstall } = await import('./commands/uninstall.js');
    await uninstall({ dryRun: opts.dryRun, yes: opts.yes });
  });

program
  .command('model [scope] [name]')
  .description('Model for the project. Examples: "mini model" (interactive), "mini model show", "mini model sonnet" (default), "mini model do opus", "mini model do default" (clears the override), "mini model reset".')
  .action(async (scope?: string, name?: string) => {
    const { model } = await import('./commands/model.js');
    await model(scope, name);
  });

program
  .command('completion <shell>')
  .description('Prints a shell completion script for `mini` (bash | zsh). Enable with: source <(mini completion bash).')
  .action(async (shell: string) => {
    const { completion } = await import('./commands/completion.js');
    // Derive the completed commands and their flags from commander itself so the
    // script never drifts from the real CLI. Skip hidden helpers (e.g.
    // check-version) and add the implicit `help` subcommand (no flags).
    const commands = program.commands
      .filter((c) => (c as unknown as { _hidden?: boolean })._hidden !== true)
      .map((c) => ({
        name: c.name(),
        flags: c.options.flatMap((o) => {
          const values = o.argChoices && o.argChoices.length > 0 ? o.argChoices : undefined;
          return [o.short, o.long]
            .filter((f): f is string => !!f)
            .map((name) => (values ? { name, values } : { name }));
        }),
      }));
    if (!commands.some((c) => c.name === 'help')) commands.push({ name: 'help', flags: [] });
    if (!completion(shell, commands)) process.exit(1);
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
