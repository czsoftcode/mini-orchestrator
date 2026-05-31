# Phase 90 — npm metadata a keywords

**Goal:** Do package.json doplnit keywords pro vyhledávání na npm a chybějící metadata balíčku (repository, homepage, bugs, author); zkontrolovat a případně doladit i description, aby byl mini-orchestrator dobře dohledatelný a měl na stránce balíčku správné odkazy.

## Steps
- [done] Add keywords to package.json
- [done] Add repository, homepage, bugs, author
- [done] Verify package via npm pack --dry-run
- [done] README + CHANGELOG

## Auto-commit
- Phase 90: npm metadata a keywords

## Run report
---
phase: 90
verdict: done
steps:
  - title: "Add keywords to package.json"
    status: done
  - title: "Add repository, homepage, bugs, author"
    status: done
  - title: "Verify package via npm pack --dry-run"
    status: done
  - title: "README + CHANGELOG"
    status: done
---

# Phase 90 — report from the auto session

Doplnil jsem do `package.json` chybějící metadata pro dohledatelnost na npm:

- **`keywords`** — 12 termínů (claude, claude-code, anthropic, ai, llm, cli,
  orchestrator, workflow, agent, project-management, phases, typescript).
- **`author`** — Stanislav Kremeň.
- **`homepage`** — `https://github.com/czsoftcode/mini-orchestrator#readme`.
- **`repository`** — `git+https://github.com/czsoftcode/mini-orchestrator.git`
  (z `git remote origin`).
- **`bugs`** — issues URL.

`description` byl už výstižný, ponechal jsem ho beze změny.

## Ověření

- JSON je validní (`JSON.parse`).
- `npm pack --dry-run` proběhl bez varování, tarball se sestaví (83 souborů).
- `npm publish --dry-run` hlásí jen „cannot publish over previously published
  version 1.7.0" — očekávané, verze se navýší až při `done --push`. Žádné
  varování k metadatům.

## Poznámky

- CHANGELOG má nový záznam pod `[Unreleased]`; při `done --push` se orazítkuje
  verzí.
- README jsem nechal beze změny — jde o balíčkovou konfiguraci, ne o uživatelskou
  funkci, takže do README nepatří.
- Nová pole se na npmjs.com projeví **až s další publikací** (`npm publish`).
