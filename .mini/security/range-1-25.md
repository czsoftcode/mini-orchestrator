# Security review — phases 1–25

- **Range:** `git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904..4a288479586257ba22b688d83bb0895dcb44bc40`
  - `from` = git **empty tree** (phase 1 has no `preSha` → genesis; see phase 167 fix)
  - `to` = `preSha` of phase 26 = `4a28847…` (state right after phase 25 committed)
- **Reviewed at HEAD:** phase 167 (`1.21.2`). Code reviewed is the **historical**
  state at end of phase 25, to match the `adversarial-project` run on the same range.
- **Method:** focused review of the security *sinks* — process execution, filesystem
  writes, untrusted-input parsing, dependency surface. **Not** an exhaustive
  line-by-line audit of all 137 files / ~20.8k lines. The empty-tree start means
  this effectively covers the whole early-codebase foundation as of phase 25.
- **Threat model:** mini is a local developer CLI. The meaningful untrusted input is
  (a) the contents of a **git-shared `.mini/`** from a cloned/pulled repo, and
  (b) CLI arguments the developer types. There is no network listener, no auth, no
  secret storage (mini relies on the user's existing Claude auth — aligned with the
  project's non-goals).

## Verdict

**No classic-injection or arbitrary-write vulnerabilities found in this range.** One
inherent **should-know** (prompt-injection / agent-trust via shared `.mini/`), plus a
few informational notes and two items that fall **outside** this range and deserve
their own check at HEAD.

---

## Findings

### SEC-1 · should-know · prompt injection / agent-trust via shared `.mini/`
**Where:** `src/prompts/*.ts` (prompt assembly) → `src/claude/work.ts:43`,
`stream.ts:271`, `ask.ts:63` (spawned with `--permission-mode acceptEdits`).

mini builds the prompts it sends to Claude from `.mini/` content — `project.md`,
phase titles/goals, discuss notes, run reports. In `auto` mode (and any flow that
passes `permissionMode: acceptEdits`), the spawned Claude session can edit files and
run its allowed tools without a per-action prompt. Because `.mini/` is **git-versioned
and shareable**, a cloned or pulled repo with a poisoned `project.md` / phase goal /
report is a prompt-injection vector against the developer who runs `mini auto` on it.

This is largely **inherent** to what mini is (an orchestrator that feeds repo content
to an agent), not a coding bug. Mitigations to record rather than "fix":
- The human checkpoint at `done` is the main safety net — do not bypass it on untrusted code.
- Treat a freshly-cloned/untrusted `.mini/` as untrusted input: avoid `mini auto --yolo`
  (acceptEdits, unattended) on a repo you didn't author until you've read its `.mini/`.
- Worth a short note in the docs/README security section.

### SEC-2 · nit (informational) · `claude --append-system-prompt` source
**Where:** `src/claude/ask.ts` (`opts.appendSystemPrompt` → `--append-system-prompt`).

In this range the value is supplied by mini's own calling code (not from `.mini/`), so
it is not currently attacker-controlled. Flagged only so it stays that way: never wire
`appendSystemPrompt` (or `allowedTools`) to a value read from repo-shared `.mini/`
content, or SEC-1 would gain a stronger primitive (system-prompt / tool-grant control).

### SEC-3 · nit (informational) · dependency surface
**Where:** `package.json` — runtime deps: `commander`, `picocolors`, `prompts`,
`typescript`.

Small, reputable set; low supply-chain surface. No action beyond routine: keep them
patched and watch advisories (CI already runs on the repo).

---

## Checked and clean (no finding)

- **Command/shell injection — none.** Every external process uses an **argv array**
  with no shell: `spawn('claude', args, …)` (`work.ts`/`stream.ts`/`ask.ts`) and
  `execFile('git', args, …)` (`git.ts:20`). No `shell: true`, no `exec()`/`execSync`,
  no string-concatenated commands anywhere in `src/`.
- **Argument injection on the prompt — mitigated.** `work.ts` and `stream.ts` push
  `'--', prompt`, so a prompt starting with `-` can't be read as a flag; `ask.ts` sends
  the prompt over **stdin**, not argv. The `model` value is always the argument *of*
  `--model` (and flags/`allowedTools` are mini-internal constants), so none can be
  smuggled in as a new option.
- **Path traversal / arbitrary write — none in range.** Writes go to **constant**
  directories (`.mini`, `.mini/memory`, `.mini/run`, `.mini/discuss`) with filenames
  built from the **numeric** `phase.id` and an internal timestamp
  (`writeMemory.ts:60`, `runReport.ts:90`, `store.ts`). No repo-controlled string
  becomes a path component. `updateLastMemoryLink` writes a symlink that targets a file
  *inside* `.mini/`. Atomic writes use tmp+rename within the same dir.
- **Deserialization — safe.** Run reports are parsed by a custom line-based
  `parseSimpleYaml` (`runReport.ts:354+`), **not** a full YAML library, so there is no
  anchor/tag/`!!js` code-execution path. State is `JSON.parse`d. No `eval`, `new
  Function`, or dynamic `require` of repo content.
- **Secrets — none handled.** mini stores no API keys or tokens (it defers to Claude's
  own auth), so there is no secret-leak surface in mini itself.

---

## Outside this range — checked separately at HEAD (phase 167 / 1.21.2)

These landed *after* phase 25 (not in the 1–25 diff) but touch the same sinks. Verified
directly against current `HEAD`:

- **`git tag` argument injection (phase 49) — SAFE.** `tagVersion`
  (`src/commands/done.ts:380`) builds `const tag = \`v${version}\``, so the argv element
  passed to `createTag`/`pushTag` (`git.ts:68,77`, `['tag', tag]` / `['push','origin',tag]`)
  **always starts with `v`** and can never be read as an option — regardless of the
  version's content. Second, independent guard: `bumpSemver` (`version.ts:48`) anchors on
  `/^(\d+)\.(\d+)\.(\d+)/` and returns `null` on anything non-numeric, so the tagged value
  is a clean `N.N.N`. No injection.
- **Per-file graph output paths (phase 32) — SAFE.** The full rebuild gets its source
  paths from `git ls-files -co --exclude-standard -z` (`buildGraph.ts:431`,
  `collectMappableFiles`), which only ever yields repo-relative, non-`..`, non-absolute
  paths — so `join(tmpDir, \`${file.path}.md\`)` stays contained. The incremental path
  (`updateGraphForFile`) additionally has an **explicit** guard
  (`buildGraph.ts:221`: rejects empty / `..`-leading / absolute `relPath`). No traversal.
  - **SEC-4 · nit (defense-in-depth):** the full-rebuild write loop
    (`buildGraph.ts:162-165`) does **not** re-apply that explicit `..`/absolute guard — it
    trusts the collector. True today; adding the same check at the write site would stop a
    future change to `collectMappableFiles` from silently reintroducing traversal. Low.
