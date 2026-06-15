# Security & the trust boundary

mini is a local developer CLI with no network listener, no auth and no secret
storage — it defers to your existing Claude Code authentication. The one security
property worth understanding before you use mini on **someone else's** repository
is the **agent-trust boundary**.

## What mini feeds to the agent

mini builds the prompts it sends to Claude from content that lives under `.mini/`:

- `.mini/project.md` — the project vision, approach and constraints
- the current phase's **title and goal**, plus its **steps**
- discuss notes and run/verify reports

That `.mini/` directory is **git-versioned and shareable** — it's committed
alongside the code so the project state survives across sessions and machines.
The flip side: when you clone or pull a repository, you also pull its `.mini/`,
and its content goes straight into the agent's prompt the next time you run a
mini step.

## The risk (SEC-1)

In normal `mini do` the classic permission mode is in effect — you confirm every
Edit and every Bash command, so a malicious instruction can't act without you
clicking "yes". The exposure is in **`mini auto`**, which runs Claude in
`acceptEdits` (`src/commands/do.ts` sets `permissionMode: 'acceptEdits'` only in
auto mode; a plain `mini do` leaves it unset). In that mode Edit/Write no longer
ask — only Bash still prompts.

So a repository with a **poisoned `.mini/`** — a `project.md`, phase goal or
report written by someone else to carry instructions for the agent rather than a
genuine project description — is a **prompt-injection vector** against whoever
runs `mini auto` on it. The injected text is read by Claude as part of its task
and, in `acceptEdits`, can be acted on by editing files in your working tree
without a per-action prompt.

This is largely **inherent** to what mini is: an orchestrator whose whole job is
to feed repo content to an agent. It is not a bug to be patched away — it's a
boundary to be aware of.

## Mitigations

- **The human `done` checkpoint is the main safety net.** Every phase ends at a
  human review (`mini done`) before it is committed. Don't bypass that checkpoint
  on code you didn't author.
- **Treat an untrusted `.mini/` as untrusted input.** Before running `mini auto`
  on a freshly cloned or pulled repository you don't trust, **read its `.mini/`**
  — `project.md`, the current phase goal, any reports — the same way you'd read a
  script before running it.
- **Don't run `mini auto` unattended on un-reviewed repos.** Autonomous,
  `acceptEdits` runs are for projects you own or have reviewed. For unfamiliar
  code, stay in classic `mini do`, where every Edit and Bash is confirmed.

## Not a secret-storage tool

mini stores no API keys or tokens of its own — authentication is handled entirely
by Claude Code, based on how you configured it. There is no secret-leak surface
in mini itself.

---

This note records finding **SEC-1** from the security review in
[`.mini/security/range-1-25.md`](../.mini/security/range-1-25.md). That review
also confirmed mini is clean of command/shell injection, argument injection and
path traversal in the reviewed range — SEC-1 is the boundary that can't be
"fixed", only understood.
