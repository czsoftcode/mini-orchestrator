# Phase 93 — Terminálový příkaz mini verify

**Goal:** Přidat top-level příkaz `mini verify` symetricky k `mini discuss`: otevře interaktivní Claude Code session s promptem z `mini context verify` jako prvním vzkazem (cílová fáze = aktuální, jinak poslední done), s povolenými nástroji pro zápis nálezů, a zaregistrovat ho v cli.ts i v --help.

## Steps
- [done] Sdílený builder verify promptu
- [done] Příkaz mini verify (verify.ts)
- [done] Registrace v cli.ts + --help
- [done] Testy příkazu verify
- [done] README + CHANGELOG

## Auto-commit
- Phase 93: Terminálový příkaz mini verify

## Run report
---
phase: 93
verdict: done
steps:
  - title: "Sdílený builder verify promptu"
    status: done
  - title: "Příkaz mini verify (verify.ts)"
    status: done
  - title: "Registrace v cli.ts + --help"
    status: done
  - title: "Testy příkazu verify"
    status: done
  - title: "README + CHANGELOG"
    status: done
---

# Phase 93 — report from the auto session

Added the missing top-level `mini verify` command, symmetric to `mini discuss`.

## What was done

- **`src/commands/verifyContext.ts`** (new) — the verify prompt builder
  (`readReportVerify` + `buildVerifyContext`) was extracted out of `context.ts`
  into a shared module, plus a `buildVerifyPrompt(cwd)` convenience that loads
  the header itself. `context.ts` now imports both from there, so behaviour of
  `mini context verify` is unchanged (proven by the existing context tests).
- **`src/commands/verify.ts`** (new) — opens an interactive Claude Code session
  with the verify prompt as the first message (current phase, otherwise the last
  closed one). Allowed tools: `Read, Edit, Grep, Glob, LS` (read + write findings
  into the report/memory). Mirrors `discuss.ts`: no-project guard, prompt
  preview, confirm, run, exit-code reporting.
- **`src/cli.ts`** — registered `.command('verify')` right after `discuss`, and
  updated the `context` description to list `verify` in the step set.
- **`src/commands/verify.test.ts`** (new, 4 tests) — no-project, no-phase,
  current-phase (asserts the tool set), and last-done fallback.
- **README** — reworded the `mini verify` table row (it had documented the
  command before it existed) to say it opens an interactive session.
- **CHANGELOG** — new entry under `[Unreleased]` / `Added`.

## Verification

Mechanically verified: `npm run build` clean, full suite **729 passed** (+4
new), `mini --help` lists `verify`, and a smoke run (`printf 'n' | mini verify`)
correctly builds the prompt for the in-progress phase 93 and cancels on "no".
The interactive session launch itself reuses the exact `workWithClaude` plumbing
already used by `mini discuss`, so nothing new there.

No items left for a human — this is internal CLI plumbing covered by tests.
